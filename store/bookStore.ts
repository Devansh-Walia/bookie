import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { Book, BookStore } from "../types";

function makeId(): string {
  return (
    Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
  );
}

const useBookStore = create<BookStore>()(
  persist(
    (set) => ({
      books: [],
      addBook: (book) =>
        set((state) => ({
          books: [
            ...state.books,
            {
              ...book,
              id: makeId(),
              lastReadAt: new Date().toISOString(),
              bookmarks: [],
              highlights: [],
            },
          ],
        })),
      updatePage: (id, page) =>
        set((state) => ({
          books: state.books.map((book) =>
            book.id === id
              ? {
                  ...book,
                  currentPage: page,
                  lastReadAt: new Date().toISOString(),
                }
              : book
          ),
        })),
      updateTotalPages: (id, totalPages) =>
        set((state) => ({
          books: state.books.map((book) =>
            book.id === id ? { ...book, totalPages } : book
          ),
        })),
      removeBook: (id) => {
        set((state) => {
          const bookToRemove = state.books.find((book) => book.id === id);
          if (bookToRemove) {
            // Delete the PDF file
            FileSystem.deleteAsync(bookToRemove.filePath, {
              idempotent: true,
            }).catch((error) => console.error("Error deleting file:", error));
          }
          return {
            books: state.books.filter((book) => book.id !== id),
          };
        });
      },
      addBookmark: (bookId, bookmark) =>
        set((state) => ({
          books: state.books.map((book) =>
            book.id === bookId
              ? {
                  ...book,
                  bookmarks: [
                    ...(book.bookmarks ?? []),
                    {
                      ...bookmark,
                      id: makeId(),
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : book
          ),
        })),
      removeBookmark: (bookId, bookmarkId) =>
        set((state) => ({
          books: state.books.map((book) =>
            book.id === bookId
              ? {
                  ...book,
                  bookmarks: (book.bookmarks ?? []).filter(
                    (b) => b.id !== bookmarkId
                  ),
                }
              : book
          ),
        })),
      addHighlight: (bookId, highlight) =>
        set((state) => ({
          books: state.books.map((book) =>
            book.id === bookId
              ? {
                  ...book,
                  highlights: [
                    ...(book.highlights ?? []),
                    {
                      ...highlight,
                      id: makeId(),
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : book
          ),
        })),
      removeHighlight: (bookId, highlightId) =>
        set((state) => ({
          books: state.books.map((book) =>
            book.id === bookId
              ? {
                  ...book,
                  highlights: (book.highlights ?? []).filter(
                    (h) => h.id !== highlightId
                  ),
                }
              : book
          ),
        })),
    }),
    {
      name: "book-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any) => {
        // Ensure books added before bookmarks/highlights existed get defaults.
        const books = Array.isArray(persistedState?.books)
          ? persistedState.books.map((book: any) => ({
              ...book,
              bookmarks: book.bookmarks ?? [],
              highlights: book.highlights ?? [],
            }))
          : [];
        return { ...persistedState, books };
      },
    }
  )
);

export default useBookStore;