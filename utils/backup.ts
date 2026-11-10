import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import useAppLockStore from "../store/appLockStore";
import useBookStore from "../store/bookStore";
import { migrateBook } from "../store/migrations";
import useSettingsStore from "../store/settingsStore";
import useStatsStore from "../store/statsStore";
import type { AppThemeMode, ReaderTheme } from "../types";
import { DEFAULT_TIERS } from "./appLock";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  formatBytes,
  parseManifest,
  type BackupManifest,
  type BackupStores,
} from "./backupFormat";
import { booksDir, coversDir } from "./files";

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  formatBytes,
  parseManifest,
  type BackupManifest,
  type BackupStores,
};

/** Above this the ZIP is built in memory and risks an OOM on a phone. */
const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

export interface ExportResult {
  uri: string;
  fileName: string;
  books: number;
  files: number;
  bytes: number;
}

export interface ImportResult {
  books: number;
  files: number;
  exportedAt: string;
  appVersion: string;
}

function listFiles(dir: Directory): File[] {
  try {
    return dir.list().filter((entry): entry is File => entry instanceof File);
  } catch {
    return [];
  }
}

function snapshotStores(): BackupStores {
  const stats = useStatsStore.getState();
  const settings = useSettingsStore.getState();
  const appLock = useAppLockStore.getState();
  return {
    books: { books: useBookStore.getState().books },
    stats: {
      days: stats.days,
      finished: stats.finished,
      dailyGoal: stats.dailyGoal,
      nightOwl: stats.nightOwl,
      earlyBird: stats.earlyBird,
    },
    settings: {
      appTheme: settings.appTheme,
      readerTheme: settings.readerTheme,
      haptics: settings.haptics,
    },
    appLock: {
      enabled: appLock.enabled,
      tiers: appLock.tiers,
      apps: appLock.apps,
      relock: appLock.relock,
    },
  };
}

/** Validates and normalises a manifest. Pure, so it is unit tested. */
export async function exportBackup(): Promise<ExportResult> {
  const bookFiles = listFiles(booksDir());
  const coverFiles = listFiles(coversDir());

  const total = [...bookFiles, ...coverFiles].reduce(
    (sum, file) => sum + (file.size || 0),
    0,
  );
  if (total > MAX_BACKUP_BYTES) {
    throw new Error(
      `Your library is ${formatBytes(total)}, too large for a single backup (limit ${formatBytes(MAX_BACKUP_BYTES)}). Remove some books and try again.`,
    );
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? "unknown",
    stores: snapshotStores(),
    files: {
      books: bookFiles.map((file) => file.name),
      covers: coverFiles.map((file) => file.name),
    },
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  for (const file of bookFiles) zip.file(`books/${file.name}`, await file.bytes());
  for (const file of coverFiles) zip.file(`covers/${file.name}`, await file.bytes());

  // STORE: PDFs and PNGs are already compressed, deflating them only burns CPU.
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });

  const fileName = `bookie-backup-${manifest.exportedAt.slice(0, 10)}.zip`;
  const out = new File(Paths.cache, fileName);
  if (out.exists) out.delete();
  out.create({ intermediates: true });
  out.write(bytes);

  return {
    uri: out.uri,
    fileName,
    books: manifest.stores.books.books.length,
    files: bookFiles.length + coverFiles.length,
    bytes: bytes.byteLength,
  };
}

export async function shareBackup(result: ExportResult): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      `Sharing is not available on this device. The backup was written to ${result.uri}`,
    );
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/zip",
    dialogTitle: "Save your Bookie backup",
    UTI: "public.zip-archive",
  });
}

/** Opens the system picker. Returns null when the user cancels. */
export async function pickBackupFile(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  return picked.assets[0].uri;
}

async function restoreFiles(
  zip: JSZip,
  folder: "books" | "covers",
  dir: Directory,
  names: string[],
): Promise<number> {
  let restored = 0;
  for (const name of names) {
    const entry = zip.file(`${folder}/${name}`);
    if (!entry) continue;
    const bytes = await entry.async("uint8array");
    const target = new File(dir, name);
    if (target.exists) target.delete();
    target.create({ intermediates: true });
    target.write(bytes);
    restored++;
  }
  return restored;
}

function applyStores(stores: BackupStores) {
  const books = (stores as any)?.books;
  if (Array.isArray(books?.books)) {
    useBookStore.setState({ books: books.books.map(migrateBook) });
  }

  const stats = (stores as any)?.stats;
  if (stats && typeof stats === "object") {
    useStatsStore.setState({
      days: stats.days && typeof stats.days === "object" ? stats.days : {},
      finished: Array.isArray(stats.finished) ? stats.finished : [],
      dailyGoal: typeof stats.dailyGoal === "number" ? stats.dailyGoal : 10,
      nightOwl: !!stats.nightOwl,
      earlyBird: !!stats.earlyBird,
    });
  }

  const settings = (stores as any)?.settings;
  if (settings && typeof settings === "object") {
    const appTheme: AppThemeMode =
      settings.appTheme === "light" || settings.appTheme === "dark"
        ? settings.appTheme
        : "system";
    useSettingsStore.setState({
      appTheme,
      readerTheme:
        typeof settings.readerTheme === "string"
          ? (settings.readerTheme as ReaderTheme)
          : "original",
      haptics: settings.haptics !== false,
    });
  }

  const appLock = (stores as any)?.appLock;
  if (appLock && typeof appLock === "object") {
    useAppLockStore.setState({
      enabled: !!appLock.enabled,
      tiers:
        Array.isArray(appLock.tiers) && appLock.tiers.length
          ? appLock.tiers
          : DEFAULT_TIERS,
      apps: Array.isArray(appLock.apps) ? appLock.apps : [],
      relock: appLock.relock ?? null,
    });
  }
}

export async function importBackup(uri: string): Promise<ImportResult> {
  const source = new File(uri);
  if (!source.exists) throw new Error("That file could not be read.");

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await source.bytes());
  } catch {
    throw new Error("That file is not a valid ZIP archive.");
  }

  const entry = zip.file("manifest.json");
  if (!entry) {
    throw new Error("This archive is not a Bookie backup (no manifest.json).");
  }
  const manifest = parseManifest(await entry.async("string"));

  // Files first: if this throws, the stores are still untouched.
  const books = await restoreFiles(zip, "books", booksDir(), manifest.files.books);
  const covers = await restoreFiles(zip, "covers", coversDir(), manifest.files.covers);

  applyStores(manifest.stores);

  return {
    books: manifest.stores.books?.books?.length ?? books,
    files: books + covers,
    exportedAt: manifest.exportedAt,
    appVersion: manifest.appVersion,
  };
}
