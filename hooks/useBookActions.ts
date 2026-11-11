import { useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Alert, Platform } from "react-native";
import useBookStore from "@/store/bookStore";
import { safeFileName } from "@/utils/paths";
import {
  requestPersistentStorage,
  writeStored,
  type FileData,
} from "@/utils/storage";
import { prettifyFileTitle } from "@/utils/titles";

/**
 * Reads the picked PDF's bytes.
 *
 * On web the picker hands back a DOM `File` (a Blob) directly. On native it
 * gives a `content://`/`file://` URI that has to be read through
 * `expo-file-system`.
 */
async function readAsset(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<FileData> {
  if (asset.file) return asset.file;
  return new File(asset.uri).bytes();
}

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

    // Browsers may evict IndexedDB for sites that aren't installed to the home
    // screen. Ask for an exemption the first time the user commits a file.
    if (Platform.OS === "web") void requestPersistentStorage();

    const ids: string[] = [];
    const failed: string[] = [];
    for (const asset of result.assets) {
      try {
        const fileName = `${Date.now()}-${safeFileName(asset.name)}`;
        await writeStored("books", fileName, await readAsset(asset));
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
