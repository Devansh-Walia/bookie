import { Directory, File, Paths } from "expo-file-system";

export { baseName, safeFileName } from "./paths";

/**
 * File locations used by the app, built on the expo-file-system `File` /
 * `Directory` API.
 *
 * Books and covers are always resolved *by file name* against the current
 * document directory instead of trusting an absolute path saved in storage:
 * on iOS the app container path changes between installs/updates, which
 * would otherwise silently break every saved book.
 */

const dirs = new Map<string, Directory>();

function appDir(name: string): Directory {
  let dir = dirs.get(name);
  if (!dir) {
    dir = new Directory(Paths.document, name);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    dirs.set(name, dir);
  }
  return dir;
}

export const booksDir = () => appDir("books");
export const coversDir = () => appDir("covers");
/**
 * Generated WebView HTML. Must live under the document directory: on iOS the
 * WebView is only granted read access to that directory, and the HTML needs
 * to load the PDF from `books/`.
 */
export const viewerCacheDir = () => appDir("pdf-viewer-cache");

export function bookFile(fileName: string): File {
  return new File(booksDir(), fileName);
}

export function coverFile(fileName: string): File {
  return new File(coversDir(), fileName);
}

export function documentDirectoryUri(): string {
  return Paths.document.uri;
}

export function deleteQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.warn("Failed to delete file", file.uri, error);
  }
}
