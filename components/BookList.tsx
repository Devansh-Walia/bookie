import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import useBookStore from "../store/bookStore";
import { Book } from "../types";
import PDFViewer from "./PDF/PDFViewer";

export default function BookList() {
  const { books, addBook, removeBook } = useBookStore();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const handleAddBook = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const bookDir = `${FileSystem.documentDirectory}books/`;
      const newPath = `${bookDir}${Date.now()}-${file.name}`;

      // Ensure books directory exists
      await FileSystem.makeDirectoryAsync(bookDir, { intermediates: true });

      // Copy file to app's document directory
      await FileSystem.copyAsync({
        from: file.uri,
        to: newPath,
      });

      addBook({
        title: file.name,
        filePath: newPath,
        fileUri: newPath,
        totalPages: 0,
        currentPage: 1,
      });
    } catch (err) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

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
          <View key={book.id} style={styles.bookItem}>
            <TouchableOpacity
              style={styles.bookContent}
              onPress={() => setSelectedBook(book)}
            >
              <View style={styles.bookHeader}>
                <Text style={styles.bookTitle} numberOfLines={1}>
                  {book.title}
                </Text>
              </View>
              <Text style={styles.lastRead}>
                Last read: {new Date(book.lastReadAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => removeBook(book.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={handleAddBook}>
          <Text style={styles.buttonText}>Add Book</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
  bookList: {
    flex: 1,
  },
  bookItem: {
    borderColor: "gray",
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    color: "white",
  },
  removeButton: {
    padding: 4,
    position: "absolute",
    top: -5,
    right: 10,
  },
  removeButtonText: {
    fontSize: 24,
    color: "#FF3B30",
    fontWeight: "600",
  },
  bookContent: {
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
    color: "white",
  },
  pageText: {
    fontSize: 16,
    color: "white",
  },
  lastRead: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
});
