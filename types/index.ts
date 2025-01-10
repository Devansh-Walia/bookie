export interface Book {
  id: string;
  title: string;
  filePath: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: string;
  fileUri: string;
}

export interface BookStore {
  books: Book[];
  addBook: (book: Omit<Book, "id" | "lastReadAt">) => void;
  updatePage: (id: string, page: number) => void;
  removeBook: (id: string) => void;
}
