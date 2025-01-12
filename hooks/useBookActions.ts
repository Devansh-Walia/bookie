import { useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Alert } from "react-native";
import useBookStore from "@/store/bookStore";

export const useBookActions = () => {
  const { addBook } = useBookStore();

  const handleAddBook = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const bookDir = `${FileSystem.documentDirectory}books/`;
      const newPath = `${bookDir}${Date.now()}-${file.name}`;

      await FileSystem.makeDirectoryAsync(bookDir, { intermediates: true });
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
  }, [addBook]);

  return { handleAddBook };
};
