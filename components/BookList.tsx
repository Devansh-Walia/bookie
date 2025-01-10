import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import useBookStore from "../store/bookStore";
import { Book } from "../types";

export default function BookList() {
  const { books, addBook, updatePage, removeBook } = useBookStore();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
  } | null>(null);
  const [showTotalPagesInput, setShowTotalPagesInput] = useState(false);
  const [totalPages, setTotalPages] = useState("");

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/epub+zip"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setSelectedFile(file);
      setShowTotalPagesInput(true);
    } catch (err) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleUpdatePage = (
    id: string,
    currentPage: string,
    totalPages: number
  ) => {
    const page = parseInt(currentPage);
    if (isNaN(page) || page < 0 || page > totalPages) {
      Alert.alert(
        "Error",
        `Please enter a valid page number between 0 and ${totalPages}`
      );
      return;
    }
    updatePage(id, page);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={handlePickDocument}>
        <Text style={styles.buttonText}>Add Book</Text>
      </TouchableOpacity>

      {showTotalPagesInput && selectedFile && (
        <View style={styles.totalPagesDialog}>
          <Text style={styles.dialogTitle}>{selectedFile.name}</Text>
          <TextInput
            style={styles.pageInput}
            placeholder="Enter total pages"
            keyboardType="numeric"
            value={totalPages}
            onChangeText={setTotalPages}
          />
          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={[styles.dialogButton, styles.cancelButton]}
              onPress={() => {
                setShowTotalPagesInput(false);
                setSelectedFile(null);
                setTotalPages("");
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogButton, styles.confirmButton]}
              onPress={() => {
                if (!totalPages) {
                  Alert.alert("Error", "Please enter total pages");
                  return;
                }
                addBook({
                  title: selectedFile.name,
                  filePath: selectedFile.uri,
                  fileUri: selectedFile.uri,
                  totalPages: parseInt(totalPages),
                  currentPage: 0,
                });
                setShowTotalPagesInput(false);
                setSelectedFile(null);
                setTotalPages("");
              }}
            >
              <Text style={styles.confirmButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.bookList}>
        {books.map((book) => (
          <View key={book.id} style={styles.bookItem}>
            <View style={styles.bookHeader}>
              <Text style={styles.bookTitle}>{book.title}</Text>
              <TouchableOpacity
                onPress={() => removeBook(book.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressContainer}>
              <TextInput
                style={styles.pageInput}
                value={book.currentPage.toString()}
                keyboardType="numeric"
                onChangeText={(text) =>
                  handleUpdatePage(book.id, text, book.totalPages)
                }
              />
              <Text style={styles.pageText}> / {book.totalPages} pages</Text>
            </View>
            <Text style={styles.lastRead}>
              Last read: {new Date(book.lastReadAt).toLocaleDateString()}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  totalPagesDialog: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  dialogButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: "#f1f1f1",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "white",
    fontWeight: "600",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  bookList: {
    flex: 1,
  },
  bookItem: {
    backgroundColor: "white",
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
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 24,
    color: "#FF3B30",
    fontWeight: "600",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  pageInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 6,
    width: 60,
    fontSize: 16,
    textAlign: "center",
  },
  pageText: {
    fontSize: 16,
    color: "#666",
  },
  lastRead: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
});
