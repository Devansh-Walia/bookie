import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import useBookStore from "../store/bookStore";
import { getPdfJsSources } from "../utils/pdfjsAssets";
import { bookFile, coverFile, documentDirectoryUri } from "../utils/files";
import { htmlSource, removeHtmlSource } from "../utils/webviewHtml";
import { cleanMetadataTitle } from "../utils/titles";
import { buildCoverHtml } from "./PDF/coverHtml";

const TIMEOUT_MS = 30000;

const TypedWebView = WebView as unknown as React.ComponentType<
  React.ComponentProps<typeof WebView<{}>>
>;

/**
 * Invisible worker that renders a cover image (page 1) for every book whose
 * `coverStatus` is "pending", one at a time. As a bonus it fills in the page
 * count and, unless the user renamed the book, a nicer title from the PDF's
 * metadata.
 */
export default function CoverGenerator() {
  const pendingId = useBookStore(
    (s) =>
      s.books.find((b) => (b.coverStatus ?? "pending") === "pending")?.id ??
      null,
  );
  const updateBook = useBookStore((s) => s.updateBook);
  const [job, setJob] = useState<{
    bookId: string;
    source: { uri: string } | { html: string };
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishJob = useCallback(
    (bookId: string, patch: Parameters<typeof updateBook>[1]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      removeHtmlSource(`cover-${bookId}`);
      // Only patch books that still exist (could have been deleted mid-job).
      if (useBookStore.getState().books.some((b) => b.id === bookId)) {
        updateBook(bookId, patch);
      }
      setJob(null);
    },
    [updateBook],
  );

  useEffect(() => {
    if (Platform.OS === "web" || !pendingId || job) return;
    let cancelled = false;
    const bookId = pendingId;

    (async () => {
      try {
        const book = useBookStore.getState().books.find((b) => b.id === bookId);
        if (!book) return;
        const pdf = bookFile(book.fileName);
        if (!pdf.exists) throw new Error("missing file");
        const { lib, worker } = await getPdfJsSources();
        const html = buildCoverHtml({
          pdfLibSource: lib,
          pdfWorkerSource: worker,
          pdfUrl: pdf.uri,
        });
        const source = await htmlSource(`cover-${bookId}`, html);
        if (cancelled) return;
        timeoutRef.current = setTimeout(
          () => finishJob(bookId, { coverStatus: "failed" }),
          TIMEOUT_MS,
        );
        setJob({ bookId, source });
      } catch (error) {
        console.warn("Cover generation failed to start", error);
        if (!cancelled) finishJob(bookId, { coverStatus: "failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingId, job, finishJob]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      if (!job) return;
      let data: any;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (data?.type === "coverError") {
        finishJob(job.bookId, { coverStatus: "failed" });
        return;
      }
      if (data?.type !== "cover" || typeof data.dataUrl !== "string") return;

      const book = useBookStore
        .getState()
        .books.find((b) => b.id === job.bookId);
      try {
        const fileName = `${job.bookId}.jpg`;
        const base64 = data.dataUrl.substring(data.dataUrl.indexOf(",") + 1);
        await coverFile(fileName).write(base64, { encoding: "base64" });

        const patch: Parameters<typeof updateBook>[1] = {
          coverFileName: fileName,
          coverStatus: "done",
        };
        if (typeof data.numPages === "number" && !book?.totalPages) {
          patch.totalPages = data.numPages;
        }
        const metaTitle = cleanMetadataTitle(data.title);
        if (metaTitle && book && !book.titleCustomized) patch.title = metaTitle;
        finishJob(job.bookId, patch);
      } catch (error) {
        console.warn("Saving cover failed", error);
        finishJob(job.bookId, { coverStatus: "failed" });
      }
    },
    [job, finishJob],
  );

  if (!job) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <TypedWebView
        key={job.bookId}
        source={job.source}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL={documentDirectoryUri()}
        onMessage={handleMessage}
        onError={() => finishJob(job.bookId, { coverStatus: "failed" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Rendered off-screen; it must still be laid out for JS to run reliably.
  hidden: {
    position: "absolute",
    width: 32,
    height: 32,
    left: -100,
    top: -100,
    opacity: 0,
  },
});
