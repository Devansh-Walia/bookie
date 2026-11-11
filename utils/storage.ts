import { File } from "expo-file-system";
import { booksDir, coversDir } from "./files";

/**
 * Platform-neutral file storage for books and covers.
 *
 * Native implementation, backed by `expo-file-system`. The web build resolves
 * `./storage.web.ts` instead (Metro picks the `.web` variant), which stores the
 * same files in IndexedDB.
 *
 * Everything is async and keyed by file name, so callers never hold a path.
 */

/** The two directories Bookie keeps files in. */
export type StoreKind = "books" | "covers";

/** Anything we can persist. `Blob` is what the web file picker hands back. */
export type FileData = Blob | Uint8Array | ArrayBuffer;

function dir(kind: StoreKind) {
  return kind === "books" ? booksDir() : coversDir();
}

function file(kind: StoreKind, name: string): File {
  return new File(dir(kind), name);
}

/** File names currently stored for `kind`. */
export async function listStored(kind: StoreKind): Promise<string[]> {
  try {
    return dir(kind)
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function hasStored(
  kind: StoreKind,
  name: string,
): Promise<boolean> {
  try {
    return file(kind, name).exists;
  } catch {
    return false;
  }
}

export async function readStored(
  kind: StoreKind,
  name: string,
): Promise<Uint8Array> {
  return file(kind, name).bytes();
}

/** Size in bytes, or 0 when the file is missing. */
export async function storedSize(
  kind: StoreKind,
  name: string,
): Promise<number> {
  try {
    const target = file(kind, name);
    return target.exists ? (target.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export async function writeStored(
  kind: StoreKind,
  name: string,
  data: FileData,
): Promise<void> {
  const target = file(kind, name);
  if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    await target.write(data);
    return;
  }
  await target.write(new Uint8Array(await data.arrayBuffer()));
}

export async function deleteStored(
  kind: StoreKind,
  name: string,
): Promise<void> {
  try {
    const target = file(kind, name);
    if (target.exists) target.delete();
  } catch (error) {
    console.warn("Failed to delete stored file", kind, name, error);
  }
}

/** A URI the UI can hand to `<Image>` / the PDF viewer. */
export async function storedUrl(
  kind: StoreKind,
  name: string,
): Promise<string | null> {
  try {
    const target = file(kind, name);
    return target.exists ? target.uri : null;
  } catch {
    return null;
  }
}

/** Frees a URL returned by `storedUrl`. A no-op on native. */
export function releaseUrl(_url: string): void {
  // Native URIs are plain paths; nothing to release.
}

/** Bytes used and available. `null` when the platform can't report it. */
export async function storageEstimate(): Promise<{
  usage: number;
  quota: number;
} | null> {
  return null;
}

/**
 * Asks the platform to keep our data out of automatic eviction.
 * Native app storage is already durable, so this is always `false`.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  return false;
}
