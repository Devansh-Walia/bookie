/**
 * Pure backup-format helpers (no native modules, safe to unit test).
 *
 * The archive is a plain ZIP:
 *   manifest.json   everything in AsyncStorage, plus the file list
 *   books/<name>    the PDFs
 *   covers/<name>   the generated cover images
 *
 * The manifest is versioned separately from the app so an old Bookie can refuse
 * a backup it does not understand instead of half-restoring it.
 */
import type { AppThemeMode, Book, LockedApp, ReaderTheme } from "../types";

export const BACKUP_FORMAT = "bookie-backup";
export const BACKUP_VERSION = 1;

export interface BackupStores {
  books: { books: Book[] };
  stats: {
    days: Record<string, { pages: number; seconds: number }>;
    finished: { bookId: string; title: string; at: string }[];
    dailyGoal: number;
    nightOwl: boolean;
    earlyBird: boolean;
  };
  settings: {
    appTheme: AppThemeMode;
    readerTheme: ReaderTheme;
    haptics: boolean;
  };
  appLock: {
    enabled: boolean;
    tiers: number[];
    apps: LockedApp[];
    relock: unknown;
  };
}

export interface BackupManifest {
  format: string;
  version: number;
  exportedAt: string;
  appVersion: string;
  stores: BackupStores;
  files: { books: string[]; covers: string[] };
}

/** Rejects names that would escape the target directory when unzipped. */
export function isSafeName(name: string): boolean {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\0")
  );
}

/** Validates and normalises a manifest. */
export function parseManifest(json: string): BackupManifest {
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("The backup manifest is not valid JSON.");
  }
  if (!raw || typeof raw !== "object" || raw.format !== BACKUP_FORMAT) {
    throw new Error("This archive is not a Bookie backup.");
  }
  if (typeof raw.version !== "number" || raw.version < 1) {
    throw new Error("The backup manifest is missing a format version.");
  }
  if (raw.version > BACKUP_VERSION) {
    throw new Error(
      `This backup was made by a newer version of Bookie (backup v${raw.version}, this app reads up to v${BACKUP_VERSION}). Update Bookie first.`,
    );
  }
  if (!raw.stores || typeof raw.stores !== "object") {
    throw new Error("The backup contains no app data.");
  }
  const names = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((n): n is string => typeof n === "string" && isSafeName(n))
      : [];
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    appVersion: typeof raw.appVersion === "string" ? raw.appVersion : "unknown",
    stores: raw.stores,
    files: { books: names(raw.files?.books), covers: names(raw.files?.covers) },
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
