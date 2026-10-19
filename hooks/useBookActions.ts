import { useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Alert } from "react-native";
import useBookStore from "@/store/bookStore";
import { bookFile, safeFileName } from "@/utils/files";
import { prettifyFileTitle } from "@/utils/titles";

export const useBookActions = () => {
  const addBook = useBookStore((s) => s.addBook);

  /** Lets the user pick one or more PDFs and imports them. Returns new ids. */
  const handleAddBook = useCallback(async (): Promise<string[]> => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
        multiple: true,
      });
    } catch {
      Alert.alert("Error", "Couldn't open the file picker.");
      return [];
    }
    if (result.canceled) return [];

    const ids: string[] = [];
    const failed: string[] = [];
    for (const asset of result.assets) {
      try {
        const fileName = `${Date.now()}-${safeFileName(asset.name)}`;
        const dest = bookFile(fileName);
        await new File(asset.uri).copy(dest);
        ids.push(addBook({ title: prettifyFileTitle(asset.name), fileName }));
      } catch (error) {
        console.warn("Import failed", asset.name, error);
        failed.push(asset.name);
      }
    }
    if (failed.length) {
      Alert.alert("Some books couldn't be imported", failed.join("\n"));
    }
    return ids;
  }, [addBook]);

  return { handleAddBook };
};
