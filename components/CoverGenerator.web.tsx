import { useCallback, useEffect, useRef } from "react";
import useBookStore from "../store/bookStore";
import { getPdfJsSources } from "../utils/pdfjsAssets";
import { releaseUrl, storedUrl, writeStored } from "../utils/storage";
import { cleanMetadataTitle } from "../utils/titles";

/**
 * Web cover generator.
 *
 * Same job as the native `CoverGenerator`, but there is no WebView to host the
 * PDF.js page: the browser runs PDF.js directly, so page 1 is rendered to an
 * offscreen canvas and encoded to a JPEG blob.
 *
 * The PDF.js build is the same vendored one the reader uses, injected as an
 * inline script so nothing depends on a CDN.
 */

/** Matches `buildCoverHtml`'s default so covers look identical across platforms. */
const TARGET_WIDTH = 360;
const JPEG_QUALITY = 0.82;
const TIMEOUT_MS = 30_000;

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { url: string }) => {
    promise: Promise<PdfDocument>;
  };
}

interface PdfDocument {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
  getMetadata: () => Promise<{ info?: { Title?: string } }>;
  destroy: () => Promise<void>;
}

interface PdfPage {
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
  };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

let pdfJsPromise: Promise<PdfJsLib> | null = null;

/** Injects the vendored PDF.js build once and caches it. */
function loadPdfJs(): Promise<PdfJsLib> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const { lib, worker } = await getPdfJsSources();

      const workerUrl = URL.createObjectURL(
        new Blob([worker], { type: "application/javascript" }),
      );

      // An inline <script> runs synchronously on append, so no load event.
      const script = document.createElement("script");
      script.textContent = lib;
      document.head.appendChild(script);

      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) throw new Error("PDF.js failed to initialise");
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })().catch((error) => {
      pdfJsPromise = null;
      throw error;
    });
  }

  return pdfJsPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't encode the cover")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export default function CoverGenerator() {
  const pendingId = useBookStore(
    (s) =>
      s.books.find((b) => (b.coverStatus ?? "pending") === "pending")?.id ??
      null,
  );
  const updateBook = useBookStore((s) => s.updateBook);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishJob = useCallback(
    (bookId: string, patch: Parameters<typeof updateBook>[1]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      if (useBookStore.getState().books.some((b) => b.id === bookId)) {
        updateBook(bookId, patch);
      }
    },
    [updateBook],
  );

  // No in-flight guard: the effect only re-runs when `pendingId` changes, and
  // two covers rendering at once is harmless (each writes its own file).
  useEffect(() => {
    if (!pendingId) return;
    const bookId = pendingId;
    let cancelled = false;

    (async () => {
      let pdfUrl: string | null = null;
      let doc: PdfDocument | null = null;
      try {
        const book = useBookStore
          .getState()
          .books.find((b) => b.id === bookId);
        if (!book) return;

        pdfUrl = await storedUrl("books", book.fileName);
        if (!pdfUrl) throw new Error("missing file");

        timeoutRef.current = setTimeout(
          () => finishJob(bookId, { coverStatus: "failed" }),
          TIMEOUT_MS,
        );

        const pdfjsLib = await loadPdfJs();
        doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;

        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await canvasToBlob(canvas);
        const fileName = `${bookId}.jpg`;
        await writeStored("covers", fileName, blob);

        const patch: Parameters<typeof updateBook>[1] = {
          coverFileName: fileName,
          coverStatus: "done",
        };
        if (!book.totalPages) patch.totalPages = doc.numPages;

        const metaTitle = cleanMetadataTitle(
          await doc
            .getMetadata()
            .then((meta) => meta?.info?.Title)
            .catch(() => null),
        );
        if (metaTitle && !book.titleCustomized) patch.title = metaTitle;

        if (!cancelled) finishJob(bookId, patch);
      } catch (error) {
        console.warn("Cover generation failed", error);
        if (!cancelled) finishJob(bookId, { coverStatus: "failed" });
      } finally {
        if (pdfUrl) releaseUrl(pdfUrl);
        if (doc) void doc.destroy().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingId, finishJob]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return null;
}
