import type { FileData, StoreKind } from "./storage";

/**
 * Web implementation of the storage layer, backed by IndexedDB.
 *
 * Same API and same file-name keys as the native version, so the stores,
 * backup and reader code are platform-agnostic.
 *
 * IndexedDB (rather than localStorage) because PDFs run to tens of megabytes
 * and localStorage caps out around 5 MB. AsyncStorage keeps the small metadata
 * in localStorage, which is fine.
 */

const DB_NAME = "bookie";
const DB_VERSION = 1;
const KINDS: StoreKind[] = ["books", "covers"];

/** Static rendering runs in Node, where IndexedDB doesn't exist. */
function available(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const kind of KINDS) {
          if (!db.objectStoreNames.contains(kind)) db.createObjectStore(kind);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("IndexedDB upgrade blocked by another tab"));
    }).catch((error) => {
      // Let the next call retry instead of caching a failure.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** Runs one request against a single object store and resolves its result. */
async function run<T>(
  kind: StoreKind,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(kind, mode);
    const request = action(tx.objectStore(kind));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

function toBlob(data: FileData): Blob {
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data]);
  return new Blob([data as Uint8Array<ArrayBuffer>]);
}

export async function listStored(kind: StoreKind): Promise<string[]> {
  if (!available()) return [];
  try {
    const keys = await run<IDBValidKey[]>(kind, "readonly", (store) =>
      store.getAllKeys(),
    );
    return keys.map(String);
  } catch (error) {
    console.warn("Failed to list stored files", kind, error);
    return [];
  }
}

export async function hasStored(
  kind: StoreKind,
  name: string,
): Promise<boolean> {
  if (!available()) return false;
  try {
    const count = await run<number>(kind, "readonly", (store) =>
      store.count(name),
    );
    return count > 0;
  } catch {
    return false;
  }
}

export async function readStored(
  kind: StoreKind,
  name: string,
): Promise<Uint8Array> {
  const blob = await run<Blob | undefined>(kind, "readonly", (store) =>
    store.get(name),
  );
  if (!blob) throw new Error(`Stored file not found: ${kind}/${name}`);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function writeStored(
  kind: StoreKind,
  name: string,
  data: FileData,
): Promise<void> {
  await run(kind, "readwrite", (store) => store.put(toBlob(data), name));
}

/** Size in bytes, or 0 when the file is missing. */
export async function storedSize(
  kind: StoreKind,
  name: string,
): Promise<number> {
  if (!available()) return 0;
  try {
    const blob = await run<Blob | undefined>(kind, "readonly", (store) =>
      store.get(name),
    );
    return blob?.size ?? 0;
  } catch {
    return 0;
  }
}

export async function deleteStored(
  kind: StoreKind,
  name: string,
): Promise<void> {
  if (!available()) return;
  try {
    await run(kind, "readwrite", (store) => store.delete(name));
  } catch (error) {
    console.warn("Failed to delete stored file", kind, name, error);
  }
}

/**
 * Object URLs are created fresh on every call, so callers must hand the result
 * back through `releaseUrl` when they're done with it.
 */
export async function storedUrl(
  kind: StoreKind,
  name: string,
): Promise<string | null> {
  if (!available()) return null;
  try {
    const blob = await run<Blob | undefined>(kind, "readonly", (store) =>
      store.get(name),
    );
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export function releaseUrl(url: string): void {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

export async function storageEstimate(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/**
 * Asks the browser to exempt our data from eviction.
 *
 * Chrome grants this for engaged sites; Safari largely ignores it and can
 * still clear IndexedDB for sites that aren't installed to the home screen.
 * The backup export is the real safety net — see `docs/WEB.md`.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
