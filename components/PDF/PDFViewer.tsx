import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import useBookStore from "../../store/bookStore";
import useStatsStore from "../../store/statsStore";
import useSettingsStore from "../../store/settingsStore";
import { getPdfJsSources } from "../../utils/pdfjsAssets";
import { bookFile, documentDirectoryUri } from "../../utils/files";
import { htmlSource } from "../../utils/webviewHtml";
import { haptics } from "../../utils/haptics";
import { useReadingSession } from "../../hooks/useReadingSession";
import { buildPdfViewerHtml } from "./pdfViewerHtml";
import { palette } from "../../constants/theme";
import { readerThemeInfo } from "../../constants/readerThemes";
import { BookmarkPickerModal, BOOKMARK_ICONS } from "./BookmarkPickerModal";
import { AnnotationsModal } from "./AnnotationsModal";
import { ReaderSettingsModal } from "./ReaderSettingsModal";
import { Celebration } from "../Celebration";

// react-native-webview's class typing (`WebView<P = undefined>`) collapses its
// props to `never` under TypeScript 6; pin the generic to `{}`.
type BookieWebView = WebView<{}>;
const TypedWebView = WebView as unknown as React.ComponentType<
  React.ComponentProps<typeof WebView<{}>> & { ref?: React.Ref<BookieWebView> }
>;

interface PDFViewerProps {
  bookId: string;
  onClose: () => void;
}

type ViewerStatus = "preparing" | "viewing" | "fatalError";

const STUCK_LOAD_TIMEOUT_MS = 30000;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export default function PDFViewer({ bookId, onClose }: PDFViewerProps) {
  const book = useBookStore((s) => s.books.find((b) => b.id === bookId));
  const updatePage = useBookStore((s) => s.updatePage);
  const updateTotalPages = useBookStore((s) => s.updateTotalPages);
  const setFinished = useBookStore((s) => s.setFinished);
  const addBookmark = useBookStore((s) => s.addBookmark);
  const removeBookmark = useBookStore((s) => s.removeBookmark);
  const addHighlight = useBookStore((s) => s.addHighlight);
  const removeHighlight = useBookStore((s) => s.removeHighlight);
  const recordFinished = useStatsStore((s) => s.recordFinished);
  const booksFinished = useStatsStore((s) => s.finished.length);

  const readerTheme = useSettingsStore((s) => s.readerTheme);
  const setReaderTheme = useSettingsStore((s) => s.setReaderTheme);
  const hapticsEnabled = useSettingsStore((s) => s.haptics);
  const setHaptics = useSettingsStore((s) => s.setHaptics);
  const themeInfo = readerThemeInfo(readerTheme);

  const [status, setStatus] = useState<ViewerStatus>("preparing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webviewSource, setWebviewSource] = useState<
    { html: string } | { uri: string } | null
  >(null);
  const [retryToken, setRetryToken] = useState(0);

  const [livePage, setLivePage] = useState(book?.currentPage ?? 1);
  const lastPageRef = useRef<number | null>(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerIcon, setPickerIcon] = useState(BOOKMARK_ICONS[0]);
  const [pickerLabel, setPickerLabel] = useState("");
  const [annotationsVisible, setAnnotationsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const webViewRef = useRef<BookieWebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { onPage: trackPage } = useReadingSession(status === "viewing");

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
        "This is taking much longer than expected. The PDF viewer may be stuck.",
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
    [inject],
  );

  useEffect(() => {
    let cancelled = false;
    const current = useBookStore.getState().books.find((b) => b.id === bookId);

    async function prepare() {
      setStatus("preparing");
      setErrorMessage(null);
      setWebviewSource(null);

      try {
        if (!current)
          throw new Error("This book is no longer in your library.");
        const pdf = bookFile(current.fileName);
        if (!pdf.exists)
          throw new Error("The PDF file for this book is missing.");

        const { lib, worker } = await getPdfJsSources();
        if (cancelled) return;

        const html = buildPdfViewerHtml({
          pdfLibSource: lib,
          pdfWorkerSource: worker,
          pdfUrl: pdf.uri,
          initialPage: current.currentPage,
          bookmarks: (current.bookmarks ?? []).map((b) => ({
            page: b.page,
            icon: b.icon,
            label: b.label,
          })),
          highlights: current.highlights ?? [],
          theme: useSettingsStore.getState().readerTheme,
        });
        const source = await htmlSource(`reader-${bookId}`, html);
        if (cancelled) return;
        setWebviewSource(source);
        setStatus("viewing");
        armStuckLoadTimeout();
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
  }, [bookId, retryToken, armStuckLoadTimeout, clearStuckLoadTimeout]);

  // Keep the WebView's bookmark set in sync with the store.
  useEffect(() => {
    if (status !== "viewing" || !book) return;
    inject(
      `window.__bookie && window.__bookie.setBookmarks(${JSON.stringify(
        book.bookmarks ?? [],
      )});`,
    );
  }, [book?.bookmarks, status, inject]);

  // Live theme switching without reloading the document.
  useEffect(() => {
    if (status !== "viewing") return;
    inject(
      `window.__bookie && window.__bookie.setTheme(${JSON.stringify(readerTheme)});`,
    );
  }, [readerTheme, status, inject]);

  const handlePageChange = useCallback(
    (page: number) => {
      const previous = lastPageRef.current;
      lastPageRef.current = page;
      setLivePage(page);
      updatePage(bookId, page);
      trackPage(page);
      if (previous !== null && previous !== page) haptics.pageTurn();

      // Reaching the last page by turning to it finishes the book.
      const current = useBookStore
        .getState()
        .books.find((b) => b.id === bookId);
      if (
        current &&
        !current.finishedAt &&
        current.totalPages > 1 &&
        page === current.totalPages &&
        previous !== null &&
        previous !== page
      ) {
        setFinished(bookId, true);
        recordFinished(bookId, current.title);
        haptics.success();
        setCelebrating(true);
      }
    },
    [bookId, updatePage, trackPage, setFinished, recordFinished],
  );

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
            const current = useBookStore
              .getState()
              .books.find((b) => b.id === bookId);
            if (current?.totalPages !== data.numPages) {
              updateTotalPages(bookId, data.numPages);
            }
          }
          break;
        case "pageChange":
          if (typeof data.page === "number") handlePageChange(data.page);
          break;
        case "addHighlight":
          if (data.highlight) {
            addHighlight(bookId, {
              page: data.highlight.page,
              text: data.highlight.text,
              color: data.highlight.color,
              rects: data.highlight.rects,
            });
            haptics.tap();
          }
          break;
        case "removeHighlight":
          if (typeof data.id === "string") removeHighlight(bookId, data.id);
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
      updateTotalPages,
      handlePageChange,
      addHighlight,
      removeHighlight,
    ],
  );

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
    haptics.tap();
    setPickerVisible(false);
  }, [addBookmark, bookId, livePage, pickerIcon, pickerLabel]);

  const containerStyle = [
    styles.container,
    { backgroundColor: themeInfo.chrome },
  ];

  if (status === "preparing") {
    return (
      <SafeAreaView style={containerStyle}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Preparing your book…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "fatalError") {
    return (
      <SafeAreaView style={containerStyle}>
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
              onPress={() => setRetryToken((t) => t + 1)}
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
    <SafeAreaView style={containerStyle}>
      <View style={styles.readerBody}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={onClose}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="chevron-down" size={24} color="#F1F5F9" />
          </TouchableOpacity>

          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => setSettingsVisible(true)}
              hitSlop={HIT_SLOP}
            >
              <Ionicons
                name="color-palette-outline"
                size={20}
                color="#F1F5F9"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={openBookmarkPicker}
              hitSlop={HIT_SLOP}
            >
              <Ionicons name="bookmark-outline" size={20} color="#F1F5F9" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => setAnnotationsVisible(true)}
              hitSlop={HIT_SLOP}
            >
              <Ionicons name="list" size={20} color="#F1F5F9" />
            </TouchableOpacity>
          </View>
        </View>

        {webviewSource ? (
          <TypedWebView
            ref={webViewRef}
            key={`${bookId}-${retryToken}`}
            style={[styles.webview, { backgroundColor: themeInfo.background }]}
            source={webviewSource}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            allowingReadAccessToURL={documentDirectoryUri()}
            onMessage={handleMessage}
            onError={(syntheticEvent) => {
              console.warn("WebView error: ", syntheticEvent.nativeEvent);
              setStatus("fatalError");
              setErrorMessage("The PDF viewer failed to load.");
            }}
          />
        ) : null}
      </View>

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

      <ReaderSettingsModal
        visible={settingsVisible}
        theme={readerTheme}
        haptics={hapticsEnabled}
        onThemeChange={(t) => {
          setReaderTheme(t);
          haptics.tap();
        }}
        onHapticsChange={setHaptics}
        onClose={() => setSettingsVisible(false)}
      />

      <Celebration
        visible={celebrating}
        title={book?.title ?? ""}
        totalPages={book?.totalPages ?? 0}
        booksFinished={booksFinished}
        onClose={() => setCelebrating(false)}
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
  readerBody: {
    flex: 1,
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
