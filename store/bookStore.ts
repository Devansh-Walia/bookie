import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Book, BookStore } from "../types";
import { bookFile, coverFile, deleteQuietly } from "../utils/files";
import { migrateBook } from "./migrations";

export function makeId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const now = () => new Date().toISOString();

function patchBook(
  books: Book[],
  id: string,
  patch: (book: Book) => Partial<Book>,
): Book[] {
  return books.map((book) =>
    book.id === id ? { ...book, ...patch(book) } : book,
  );
}

const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      books: [],
      addBook: ({ title, fileName }) => {
        const id = makeId();
        const timestamp = now();
        set((state) => ({
          books: [
            ...state.books,
            {
              id,
              title,
              fileName,
              currentPage: 1,
              totalPages: 0,
              lastReadAt: timestamp,
              addedAt: timestamp,
              coverStatus: "pending",
              bookmarks: [],
              highlights: [],
            },
          ],
        }));
        return id;
      },
      updateBook: (id, patch) =>
        set((state) => ({ books: patchBook(state.books, id, () => patch) })),
      renameBook: (id, title) =>
        set((state) => ({
          books: patchBook(state.books, id, () => ({
            title: title.trim() || "Untitled",
            titleCustomized: true,
          })),
        })),
      updatePage: (id, page) =>
        set((state) => ({
          books: patchBook(state.books, id, () => ({
            currentPage: page,
            lastReadAt: now(),
          })),
        })),
      updateTotalPages: (id, totalPages) =>
        set((state) => ({
          books: patchBook(state.books, id, () => ({ totalPages })),
        })),
      setFinished: (id, finished) =>
        set((state) => ({
          books: patchBook(state.books, id, () => ({
            finishedAt: finished ? now() : undefined,
          })),
        })),
      removeBook: (id) => {
        const book = get().books.find((b) => b.id === id);
        if (book) {
          deleteQuietly(bookFile(book.fileName));
          if (book.coverFileName) deleteQuietly(coverFile(book.coverFileName));
        }
        set((state) => ({ books: state.books.filter((b) => b.id !== id) }));
      },
      addBookmark: (bookId, bookmark) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            bookmarks: [
              ...(book.bookmarks ?? []),
              { ...bookmark, id: makeId(), createdAt: now() },
            ],
          })),
        })),
      removeBookmark: (bookId, bookmarkId) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            bookmarks: (book.bookmarks ?? []).filter(
              (b) => b.id !== bookmarkId,
            ),
          })),
        })),
      addHighlight: (bookId, highlight) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            highlights: [
              ...(book.highlights ?? []),
              { ...highlight, id: makeId(), createdAt: now() },
            ],
          })),
        })),
      removeHighlight: (bookId, highlightId) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            highlights: (book.highlights ?? []).filter(
              (h) => h.id !== highlightId,
            ),
          })),
        })),
    }),
    {
      name: "book-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any) => ({
        ...persistedState,
        books: Array.isArray(persistedState?.books)
          ? persistedState.books.map(migrateBook)
          : [],
      }),
    },
  ),
);

export default useBookStore;
