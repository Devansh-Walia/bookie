export interface Bookmark {
  id: string;
  page: number;
  label: string;
  icon: string; // emoji chosen by the user
  createdAt: string;
}

/** A highlight rectangle, normalized to the page (0..1 of width/height). */
export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  page: number;
  text: string;
  color: string;
  rects: HighlightRect[];
  createdAt: string;
}

export type CoverStatus = "pending" | "done" | "failed";

export interface Book {
  id: string;
  title: string;
  /** True once the user renamed the book; stops auto-titling from PDF metadata. */
  titleCustomized?: boolean;
  /** PDF file name inside the app's `books/` directory. */
  fileName: string;
  currentPage: number;
  /** 0 until the PDF has been opened/scanned once. */
  totalPages: number;
  lastReadAt: string;
  addedAt: string;
  /** Cover image file name inside the app's `covers/` directory. */
  coverFileName?: string;
  coverStatus?: CoverStatus;
  /** ISO timestamp the reader reached the last page (or marked it finished). */
  finishedAt?: string;
  bookmarks: Bookmark[];
  highlights: Highlight[];
}

export type NewBook = Pick<Book, "title" | "fileName">;

export interface BookStore {
  books: Book[];
  /** Adds a book and returns its generated id. */
  addBook: (book: NewBook) => string;
  updateBook: (id: string, patch: Partial<Omit<Book, "id">>) => void;
  renameBook: (id: string, title: string) => void;
  updatePage: (id: string, page: number) => void;
  updateTotalPages: (id: string, totalPages: number) => void;
  setFinished: (id: string, finished: boolean) => void;
  removeBook: (id: string) => void;
  addBookmark: (
    bookId: string,
    bookmark: Omit<Bookmark, "id" | "createdAt">,
  ) => void;
  removeBookmark: (bookId: string, bookmarkId: string) => void;
  addHighlight: (
    bookId: string,
    highlight: Omit<Highlight, "id" | "createdAt">,
  ) => void;
  removeHighlight: (bookId: string, highlightId: string) => void;
}

/** Reading activity for a single local calendar day (key: YYYY-MM-DD). */
export interface DayLog {
  pages: number;
  seconds: number;
}

export interface FinishedEntry {
  bookId: string;
  title: string;
  at: string;
}

export type ReaderTheme = "original" | "sepia" | "night" | "candlelight";

/** App-wide appearance. "system" follows the OS setting. */
export type AppThemeMode = "system" | "light" | "dark";

/** An app the user locked behind reading (Android only). */
export interface LockedApp {
  packageName: string;
  label: string;
  /** 0-based index into the tier list. */
  tier: number;
}
