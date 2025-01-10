import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Book, BookStore } from "../types";

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
              id: Math.random().toString(36).substring(7),
              lastReadAt: new Date().toISOString(),
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
      removeBook: (id) =>
        set((state) => ({
          books: state.books.filter((book) => book.id !== id),
        })),
    }),
    {
      name: "book-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useBookStore;
