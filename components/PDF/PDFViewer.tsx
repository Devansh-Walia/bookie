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
import { Ionicons } from "@expo/vector-icons";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import useBookStore from "../../store/bookStore";
import { getPdfJsSources } from "../../utils/pdfjsAssets";
import { buildPdfViewerHtml } from "./pdfViewerHtml";
import { palette } from "../../constants/theme";
import { BookmarkPickerModal, BOOKMARK_ICONS } from "./BookmarkPickerModal";
import { AnnotationsModal } from "./AnnotationsModal";

interface PDFViewerProps {
  bookId: string;
  fileUri: string;
  currentPage: number;
  onClose: () => void;
}

type ViewerStatus = "preparing" | "viewing" | "fatalError";

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
  const book = useBookStore((s) => s.books.find((b) => b.id === bookId));
  const updatePage = useBookStore((s) => s.updatePage);
  const updateTotalPages = useBookStore((s) => s.updateTotalPages);
  const addBookmark = useBookStore((s) => s.addBookmark);
  const removeBookmark = useBookStore((s) => s.removeBookmark);
  const addHighlight = useBookStore((s) => s.addHighlight);
  const removeHighlight = useBookStore((s) => s.removeHighlight);

  const [status, setStatus] = useState<ViewerStatus>("preparing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webviewSource, setWebviewSource] = useState<
    { html: string } | { uri: string } | null
  >(null);
  const [retryToken, setRetryToken] = useState(0);

  const [livePage, setLivePage] = useState(currentPage);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerIcon, setPickerIcon] = useState(BOOKMARK_ICONS[0]);
  const [pickerLabel, setPickerLabel] = useState("");

  const [annotationsVisible, setAnnotationsVisible] = useState(false);

  const webViewRef = useRef<WebView>(null);
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

  const inject = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`${js} true;`);
  }, []);

  const jumpToPage = useCallback(
    (page: number) => {
      inject(`window.__bookie && window.__bookie.jumpToPage(${page});`);
      setAnnotationsVisible(false);
    },
    [inject]
  );

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
          bookmarks: (book?.bookmarks ?? []).map((b) => ({
            page: b.page,
            icon: b.icon,
            label: b.label,
          })),
          highlights: book?.highlights ?? [],
        });

        if (Platform.OS === "web") {
          if (cancelled) return;
          setWebviewSource({ html });
        } else {
          const htmlDir = `${FileSystem.documentDirectory}pdf-viewer-cache/`;
          await FileSystem.makeDirectoryAsync(htmlDir, {
            intermediates: true,
          }).catch(() => {});
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

  // Keep the WebView's bookmark set in sync with the store.
  useEffect(() => {
    if (status !== "viewing" || !book) return;
    inject(
      `window.__bookie && window.__bookie.setBookmarks(${JSON.stringify(
        book.bookmarks ?? []
      )});`
    );
  }, [book?.bookmarks, status, inject]);

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
          armStuckLoadTimeout();
          break;
        case "ready":
          clearStuckLoadTimeout();
          if (typeof data.numPages === "number") {
            updateTotalPages(bookId, data.numPages);
          }
          break;
        case "pageChange":
          if (typeof data.page === "number") {
            setLivePage(data.page);
            updatePage(bookId, data.page);
          }
          break;
        case "addHighlight":
          if (data.highlight) {
            addHighlight(bookId, {
              page: data.highlight.page,
              text: data.highlight.text,
              color: data.highlight.color,
              rects: data.highlight.rects,
            });
          }
          break;
        case "removeHighlight":
          if (typeof data.id === "string") {
            removeHighlight(bookId, data.id);
          }
          break;
        case "error":
          console.warn("PDF viewer reported an error:", data.message);
          break;
      }
    },
    [
      armStuckLoadTimeout,
      clearStuckLoadTimeout,
      bookId,
      updatePage,
      updateTotalPages,
      addHighlight,
      removeHighlight,
    ]
  );

  const handleRetry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  const openBookmarkPicker = useCallback(() => {
    setPickerIcon(BOOKMARK_ICONS[0]);
    setPickerLabel("");
    setPickerVisible(true);
  }, []);

  const saveBookmark = useCallback(() => {
    addBookmark(bookId, {
      page: livePage,
      icon: pickerIcon,
      label: pickerLabel.trim(),
    });
    setPickerVisible(false);
  }, [addBookmark, bookId, livePage, pickerIcon, pickerLabel]);

  if (status === "preparing") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Preparing your book…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "fatalError") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={32} color={palette.danger} />
          </View>
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
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-down" size={24} color="#F1F5F9" />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={openBookmarkPicker}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="bookmark-outline" size={20} color="#F1F5F9" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => setAnnotationsVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="list" size={20} color="#F1F5F9" />
          </TouchableOpacity>
        </View>
      </View>

      {webviewSource ? (
        <WebView
          ref={webViewRef}
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

      <BookmarkPickerModal
        visible={pickerVisible}
        icon={pickerIcon}
        label={pickerLabel}
        onIconChange={setPickerIcon}
        onLabelChange={setPickerLabel}
        onCancel={() => setPickerVisible(false)}
        onSave={saveBookmark}
      />

      <AnnotationsModal
        visible={annotationsVisible}
        bookmarks={book?.bookmarks ?? []}
        highlights={book?.highlights ?? []}
        onClose={() => setAnnotationsVisible(false)}
        onJump={jumpToPage}
        onRemoveBookmark={(id) => removeBookmark(bookId, id)}
        onRemoveHighlight={(id) => removeHighlight(bookId, id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.darkBackground,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: palette.darkBackground,
  },
  loadingText: {
    fontSize: 16,
    color: palette.textOnDarkMuted,
    textAlign: "center",
    marginTop: 16,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.textOnDark,
    textAlign: "center",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: palette.textOnDarkMuted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  errorActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  retryButton: {
    backgroundColor: palette.primary,
  },
  closeActionButton: {
    backgroundColor: palette.darkSurface,
    borderWidth: 1,
    borderColor: palette.darkBorder,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
    backgroundColor: palette.darkBackground,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  topBarRight: {
    flexDirection: "row",
    gap: 10,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});