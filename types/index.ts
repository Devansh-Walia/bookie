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

export interface Book {
  id: string;
  title: string;
  filePath: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: string;
  fileUri: string;
  bookmarks: Bookmark[];
  highlights: Highlight[];
}

export interface BookStore {
  books: Book[];
  addBook: (
    book: Omit<Book, "id" | "lastReadAt" | "bookmarks" | "highlights">
  ) => void;
  updatePage: (id: string, page: number) => void;
  updateTotalPages: (id: string, totalPages: number) => void;
  removeBook: (id: string) => void;
  addBookmark: (
    bookId: string,
    bookmark: Omit<Bookmark, "id" | "createdAt">
  ) => void;
  removeBookmark: (bookId: string, bookmarkId: string) => void;
  addHighlight: (
    bookId: string,
    highlight: Omit<Highlight, "id" | "createdAt">
  ) => void;
  removeHighlight: (bookId: string, highlightId: string) => void;
}