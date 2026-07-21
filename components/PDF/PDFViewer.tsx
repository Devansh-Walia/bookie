import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import useBookStore from "../../store/bookStore";
import { getPdfJsSources } from "../../utils/pdfjsAssets";
import { buildPdfViewerHtml } from "./pdfViewerHtml";

interface PDFViewerProps {
  bookId: string;
  fileUri: string;
  currentPage: number;
  onClose: () => void;
}

type ViewerStatus = "preparing" | "viewing" | "fatalError";

// If we haven't heard *anything* back from the WebView (progress, ready, or
// error) this long after it mounts, treat it as stuck rather than leaving
// the user staring at a spinner forever.
const STUCK_LOAD_TIMEOUT_MS = 30000;

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export default function PDFViewer({
  bookId,
  fileUri,
  currentPage,
  onClose,
}: PDFViewerProps) {
  const { updatePage } = useBookStore();

  const [status, setStatus] = useState<ViewerStatus>("preparing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webviewSource, setWebviewSource] = useState<
    { html: string } | { uri: string } | null
  >(null);
  // Bumped on manual retry to force a full WebView remount (new JS context),
  // which is the only reliable way to recover from a truly hung WebView.
  const [retryToken, setRetryToken] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStuckLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const armStuckLoadTimeout = useCallback(() => {
    clearStuckLoadTimeout();
    timeoutRef.current = setTimeout(() => {
      setStatus("fatalError");
      setErrorMessage(
        "This is taking much longer than expected. The PDF viewer may be stuck."
      );
    }, STUCK_LOAD_TIMEOUT_MS);
  }, [clearStuckLoadTimeout]);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      setStatus("preparing");
      setErrorMessage(null);
      setWebviewSource(null);

      try {
        const { lib, worker } = await getPdfJsSources();
        if (cancelled) return;

        const html = buildPdfViewerHtml({
          pdfLibSource: lib,
          pdfWorkerSource: worker,
          pdfUrl: fileUri,
          initialPage: currentPage,
        });

        if (Platform.OS === "web") {
          if (cancelled) return;
          setWebviewSource({ html });
        } else {
          // Written to disk (rather than passed via source.html) so the page
          // loads from a real file:// origin. PDF.js can then fetch the PDF
          // file directly/streamed instead of the whole document being
          // serialized across the RN<->WebView bridge as base64.
          const htmlDir = `${FileSystem.documentDirectory}pdf-viewer-cache/`;
          await FileSystem.makeDirectoryAsync(htmlDir, {
            intermediates: true,
          }).catch(() => {
            // Already exists - fine.
          });
          const htmlPath = `${htmlDir}${bookId}.html`;
          await FileSystem.writeAsStringAsync(htmlPath, html);
          if (cancelled) return;
          setWebviewSource({ uri: htmlPath });
        }

        if (!cancelled) {
          setStatus("viewing");
          armStuckLoadTimeout();
        }
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(describeError(error));
        setStatus("fatalError");
      }
    }

    prepare();

    return () => {
      cancelled = true;
      clearStuckLoadTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUri, retryToken]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let data: any;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      switch (data?.type) {
        case "progress":
          // Any progress means it's not stuck - push the watchdog out.
          armStuckLoadTimeout();
          break;
        case "ready":
          clearStuckLoadTimeout();
          break;
        case "pageChange":
          if (typeof data.page === "number") {
            updatePage(bookId, data.page);
          }
          break;
        case "error":
          // The in-page overlay already offers its own Retry button for
          // load failures; just log for diagnostics.
          console.warn("PDF viewer reported an error:", data.message);
          break;
      }
    },
    [armStuckLoadTimeout, clearStuckLoadTimeout, bookId, updatePage]
  );

  const handleRetry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  if (status === "preparing") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Preparing viewer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "fatalError") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t open this PDF</Text>
          {errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : null}
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={handleRetry}
            >
              <Text style={styles.actionButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.closeActionButton]}
              onPress={onClose}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.closeContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      {webviewSource ? (
        <WebView
          key={`${bookId}-${retryToken}`}
          style={styles.webview}
          source={webviewSource}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={FileSystem.documentDirectory ?? undefined}
          onMessage={handleMessage}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn("WebView error: ", nativeEvent);
            setStatus("fatalError");
            setErrorMessage("The PDF viewer failed to load.");
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  errorActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButton: {
    backgroundColor: "#3498db",
  },
  closeActionButton: {
    backgroundColor: "#999",
  },
  actionButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
  closeContainer: {
    position: "absolute",
    top: 90,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  closeButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "600",
  },
});
