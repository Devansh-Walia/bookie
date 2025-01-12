import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { PDFViewerControls } from "./PDFViewerControls";
import useBookStore from "@/store/bookStore";

interface PDFViewerProps {
  bookId: string;
  fileUri: string;
  currentPage: number;
  onClose: () => void;
}

export const PDFViewer = ({
  bookId,
  fileUri,
  currentPage,
  onClose,
}: PDFViewerProps) => {
  const { updatePage } = useBookStore();

  return (
    <SafeAreaView style={styles.container}>
      <PDFViewerControls onClose={onClose} />
      <WebView
        style={styles.webview}
        source={{
          uri: fileUri,
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "pageChange") {
              updatePage(bookId, data.page);
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  webview: {
    flex: 1,
  },
});
