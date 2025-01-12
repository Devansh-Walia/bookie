import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Text,
  Modal,
  StyleSheet,
} from "react-native";
import useBookStore from "@/store/bookStore";
import { Book } from "@/types";
import { PDFViewer } from "../PDF/PDFViewer";
import { BookItem } from "./BookItem";
import { useBookActions } from "@/hooks/useBookActions";

export const BookList = () => {
  const { books, removeBook } = useBookStore();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const { handleAddBook } = useBookActions();

  return (
    <View style={styles.container}>
      {selectedBook && (
        <Modal
          animationType="slide"
          visible={!!selectedBook}
          onRequestClose={() => setSelectedBook(null)}
        >
          <PDFViewer
            bookId={selectedBook.id}
            fileUri={selectedBook.fileUri}
            currentPage={selectedBook.currentPage}
            onClose={() => setSelectedBook(null)}
          />
        </Modal>
      )}

      <ScrollView style={styles.bookList}>
        {books.map((book) => (
          <BookItem
            key={book.id}
            book={book}
            onSelect={setSelectedBook}
            onRemove={removeBook}
          />
        ))}
        <TouchableOpacity style={styles.addButton} onPress={handleAddBook}>
          <Text style={styles.buttonText}>Add Book</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  bookList: {
    flex: 1,
  },
  addButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    borderColor: "gray",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  buttonText: {
    color: "gray",
    fontSize: 16,
    fontWeight: "600",
  },
});
