import type { Book } from "../types";
import { baseName } from "../utils/paths";
import { prettifyFileTitle } from "../utils/titles";

const now = () => new Date().toISOString();

/**
 * Upgrades a persisted book from any previous schema version:
 *  - v0: no bookmarks/highlights
 *  - v1: absolute `filePath`/`fileUri`, raw file name as title
 */
export function migrateBook(raw: any): Book {
  const { filePath, fileUri, ...book } = raw ?? {};
  const fileName: string = book.fileName ?? baseName(filePath ?? fileUri ?? "");
  return {
    ...book,
    fileName,
    title: book.titleCustomized
      ? book.title
      : prettifyFileTitle(book.title ?? fileName),
    currentPage: book.currentPage ?? 1,
    totalPages: book.totalPages ?? 0,
    lastReadAt: book.lastReadAt ?? now(),
    addedAt: book.addedAt ?? book.lastReadAt ?? now(),
    coverStatus: book.coverFileName ? "done" : (book.coverStatus ?? "pending"),
    bookmarks: book.bookmarks ?? [],
    highlights: book.highlights ?? [],
  };
}
