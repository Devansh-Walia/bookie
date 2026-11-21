import { PAGE_CURL_SOURCE } from "./pageCurl";
import { COMPUTE_RENDER_SCALE_SOURCE } from "./pdfRenderScale";
import { VIEWER_CSS } from "./pdfViewerStyles";
import { buildViewerScript } from "./pdfViewerScript";

export interface HighlightRectInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightInput {
  id: string;
  page: number;
  color: string;
  rects: HighlightRectInput[];
}

export interface BookmarkInput {
  page: number;
  icon: string;
  label: string;
}

export interface BuildPdfViewerHtmlOptions {
  /** Source text of the PDF.js main library (pdf.min.js). */
  pdfLibSource: string;
  /** Source text of the PDF.js worker (pdf.worker.min.js). */
  pdfWorkerSource: string;
  /** URL PDF.js should fetch the document from. */
  pdfUrl: string;
  /** Page to render first. */
  initialPage: number;
  /** Existing bookmarks (page -> icon) to show indicators for. */
  bookmarks?: BookmarkInput[];
  /** Existing highlights to draw onto their pages. */
  highlights?: HighlightInput[];
  /** Reader theme id applied via `body[data-theme]`. */
  theme?: string;
  /**
   * Script emitted before anything else in the document. The web build uses it
   * to define the `window.ReactNativeWebView` bridge that the viewer script
   * posts through.
   */
  preludeScript?: string;
}

/** Escapes any `</script` sequence so inlined source can't prematurely
 * terminate the enclosing <script> tag when the HTML parser scans it. */
export function escapeClosingScriptTag(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

/**
 * Builds the full HTML document rendered inside the PDF viewer's WebView.
 *
 * Page turns are a FlipHTML5-style page curl (see pageCurl.ts): the sheet
 * being turned (`#pageFront`) is clipped along a fold line, its lifted part
 * is mirrored over it as the back of the paper (`#flap`), and the page it
 * uncovers (`#pageBack`) is shaded underneath. The curl follows the finger or
 * mouse; taps, keys, the wheel and the buttons animate it. Everything sits in
 * `#stage`, which pinch / double-tap zoom scales and pans.
 *
 * Reader features (see pdfViewerScript.ts / pdfViewerStyles.ts):
 *  - Text selection & highlighting via a transparent PDF.js text layer.
 *  - Bookmark ribbon indicator.
 *  - Keyboard page turns (arrows, PageUp/PageDown, Space, Home/End) plus
 *    Tab/Shift+Tab between the on-page controls.
 */
export function buildPdfViewerHtml({
  pdfLibSource,
  pdfWorkerSource,
  pdfUrl,
  initialPage,
  bookmarks = [],
  highlights = [],
  theme = "original",
  preludeScript = "",
}: BuildPdfViewerHtmlOptions): string {
  const safeLibSource = escapeClosingScriptTag(pdfLibSource);
  const workerSourceLiteral = escapeClosingScriptTag(
    JSON.stringify(pdfWorkerSource),
  );
  const pdfUrlLiteral = escapeClosingScriptTag(JSON.stringify(pdfUrl));
  const safeInitialPage =
    Number.isFinite(initialPage) && initialPage > 0
      ? Math.floor(initialPage)
      : 1;
  const bookmarksLiteral = escapeClosingScriptTag(JSON.stringify(bookmarks));
  const highlightsLiteral = escapeClosingScriptTag(JSON.stringify(highlights));
  const safeTheme = /^[a-z-]+$/.test(theme) ? theme : "original";

  const script = buildViewerScript({
    pdfUrlLiteral,
    workerSourceLiteral,
    safeInitialPage,
    bookmarksLiteral,
    highlightsLiteral,
    computeRenderScaleSource: COMPUTE_RENDER_SCALE_SOURCE,
    pageCurlSource: PAGE_CURL_SOURCE,
  });

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>${VIEWER_CSS}</style>
    ${preludeScript ? `<script>${escapeClosingScriptTag(preludeScript)}</script>` : ""}
  </head>
  <body data-theme="${safeTheme}">
    <div id="viewer" tabindex="0" role="region" aria-label="Book pages">
      <div id="stage">
        <div id="pageBack" class="page-layer"></div>
        <div id="underClip" class="curl-clip"><div id="underShade" class="curl-band"></div></div>
        <div id="pageFront" class="page-layer"></div>
        <div id="flapClip" class="curl-clip">
          <div id="flapCast">
            <div id="flap" class="page-container">
              <canvas id="flapCanvas"></canvas>
              <div class="flap-paper"></div>
              <div id="flapShade" class="curl-band"></div>
            </div>
          </div>
        </div>
      </div>
      <div id="bookmarkRibbon"></div>
      <div id="highlightToolbar">
        <span class="swatch" style="background:#FACC15"></span>
        <span class="swatch" style="background:#4ADE80"></span>
        <span class="swatch" style="background:#60A5FA"></span>
        <span class="swatch" style="background:#F472B6"></span>
      </div>
      <div id="controls">
        <button id="prev" disabled aria-label="Previous page" aria-keyshortcuts="ArrowLeft PageUp">&#8249;</button>
        <span id="pageInfo" role="status" aria-live="polite" aria-atomic="true">Page ${safeInitialPage}</span>
        <button id="next" disabled aria-label="Next page" aria-keyshortcuts="ArrowRight PageDown">&#8250;</button>
      </div>
      <div id="statusOverlay">
        <div id="statusSpinner"></div>
        <div id="statusText">Loading PDF…</div>
        <button id="retryButton">Retry</button>
      </div>
    </div>

    <script>
${safeLibSource}
    </script>
    <script>
${script}
    </script>
  </body>
</html>
`;
}
