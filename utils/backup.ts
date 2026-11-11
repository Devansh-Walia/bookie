import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { Platform } from "react-native";
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
import { listStored, readStored, storedSize, writeStored } from "./storage";

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
  fileName: string;
  books: number;
  files: number;
  bytes: number;
  /** The ZIP itself, so the caller can save or share it. */
  data: Uint8Array;
}

export interface ImportResult {
  books: number;
  files: number;
  exportedAt: string;
  appVersion: string;
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
  const bookNames = await listStored("books");
  const coverNames = await listStored("covers");

  let total = 0;
  for (const name of bookNames) total += await storedSize("books", name);
  for (const name of coverNames) total += await storedSize("covers", name);
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
    files: { books: bookNames, covers: coverNames },
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  for (const name of bookNames) {
    zip.file(`books/${name}`, await readStored("books", name));
  }
  for (const name of coverNames) {
    zip.file(`covers/${name}`, await readStored("covers", name));
  }

  // STORE: PDFs and PNGs are already compressed, deflating them only burns CPU.
  const data = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });

  return {
    fileName: `bookie-backup-${manifest.exportedAt.slice(0, 10)}.zip`,
    books: manifest.stores.books.books.length,
    files: bookNames.length + coverNames.length,
    bytes: data.byteLength,
    data,
  };
}

/**
 * Hands the ZIP to the user: the share sheet on native, a plain download on
 * web (there is no share sheet in a browser).
 */
export async function saveBackup(result: ExportResult): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([result.data as BlobPart], {
      type: "application/zip",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    // Let the browser start the download before the URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  const out = new File(Paths.cache, result.fileName);
  if (out.exists) out.delete();
  out.create({ intermediates: true });
  await out.write(result.data);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      `Sharing is not available on this device. The backup was written to ${out.uri}`,
    );
  }
  await Sharing.shareAsync(out.uri, {
    mimeType: "application/zip",
    dialogTitle: "Save your Bookie backup",
    UTI: "public.zip-archive",
  });
}

/** Opens the system picker. Returns the ZIP bytes, or null when cancelled. */
export async function pickBackupFile(): Promise<Uint8Array | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  return new File(asset.uri).bytes();
}

async function restoreFiles(
  zip: JSZip,
  kind: "books" | "covers",
  names: string[],
): Promise<number> {
  let restored = 0;
  for (const name of names) {
    const entry = zip.file(`${kind}/${name}`);
    if (!entry) continue;
    await writeStored(kind, name, await entry.async("uint8array"));
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

export async function importBackup(data: Uint8Array): Promise<ImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("That file is not a valid ZIP archive.");
  }

  const entry = zip.file("manifest.json");
  if (!entry) {
    throw new Error("This archive is not a Bookie backup (no manifest.json).");
  }
  const manifest = parseManifest(await entry.async("string"));

  // Files first: if this throws, the stores are still untouched.
  const books = await restoreFiles(zip, "books", manifest.files.books);
  const covers = await restoreFiles(zip, "covers", manifest.files.covers);

  applyStores(manifest.stores);

  return {
    books: manifest.stores.books?.books?.length ?? books,
    files: books + covers,
    exportedAt: manifest.exportedAt,
    appVersion: manifest.appVersion,
  };
}
