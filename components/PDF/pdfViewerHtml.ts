import { COMPUTE_RENDER_SCALE_SOURCE } from "./pdfRenderScale";

export interface BuildPdfViewerHtmlOptions {
  /** Source text of the PDF.js main library (pdf.min.js). */
  pdfLibSource: string;
  /** Source text of the PDF.js worker (pdf.worker.min.js). */
  pdfWorkerSource: string;
  /**
   * URL PDF.js should fetch the document from. On native this is a `file://`
   * URI (same-origin as this HTML, which is also written to disk), letting
   * PDF.js stream/range-request the bytes directly instead of the whole
   * file being pushed through the RN<->WebView bridge as base64. On web
   * this can be a blob:/http(s): URL.
   */
  pdfUrl: string;
  /** Page to render first. */
  initialPage: number;
}

/**
 * Escapes any `</script` sequence so inlined source can't prematurely
 * terminate the enclosing <script> tag when the HTML parser scans it.
 * This is purely a textual/HTML-parsing concern: `<\/script` and `</script`
 * represent the exact same runtime string/behavior in JS, so this is always
 * safe to apply, including inside string literals.
 */
function escapeClosingScriptTag(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

/**
 * Builds the full HTML document rendered inside the PDF viewer's WebView.
 *
 * Key differences from loading the whole file as base64 (the previous
 * approach): PDF.js is given a URL and reads the file itself (streaming /
 * range-requesting where the platform supports it), so memory use stays
 * roughly constant regardless of file size. PDF.js itself (and its worker)
 * are inlined from locally bundled source (see utils/pdfjsAssets.ts) rather
 * than fetched from a CDN, so the viewer works offline and avoids
 * cross-origin restrictions that apply once the page is served from a
 * `file://` origin.
 */
export function buildPdfViewerHtml({
  pdfLibSource,
  pdfWorkerSource,
  pdfUrl,
  initialPage,
}: BuildPdfViewerHtmlOptions): string {
  const safeLibSource = escapeClosingScriptTag(pdfLibSource);
  const workerSourceLiteral = escapeClosingScriptTag(
    JSON.stringify(pdfWorkerSource)
  );
  const pdfUrlLiteral = escapeClosingScriptTag(JSON.stringify(pdfUrl));
  const safeInitialPage =
    Number.isFinite(initialPage) && initialPage > 0
      ? Math.floor(initialPage)
      : 1;
  const computeRenderScaleSource = COMPUTE_RENDER_SCALE_SOURCE;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes" />
    <style>
      body, html {
        margin: 0;
        padding: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: #2C3E50;
        font-family: -apple-system, BlinkMacSystemFont, system-ui;
        touch-action: manipulation;
        overflow: hidden;
      }
      #controls {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
        background-color: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 100;
      }
      #controls button {
        margin: 0 15px;
        padding: 10px 20px;
        background: linear-gradient(145deg, #3498db, #2980b9);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 16px;
        font-weight: 500;
        min-width: 120px;
        touch-action: manipulation;
        transition: transform 0.2s, background 0.3s;
        cursor: pointer;
      }
      #controls button:active {
        transform: scale(0.95);
        background: linear-gradient(145deg, #2980b9, #3498db);
      }
      #controls button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      #pageInfo {
        color: white;
        margin: 0 10px;
        min-width: 100px;
        text-align: center;
        font-size: 16px;
        font-weight: 500;
      }
      #viewer {
        flex: 1;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        perspective: 1000px;
        transform-style: preserve-3d;
        background: #1a2634;
      }
      .page-wrapper {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        transform-style: preserve-3d;
      }
      #currentPage {
        z-index: 2;
        transition: transform 0.8s cubic-bezier(0.5, 0, 0.2, 1);
      }
      canvas {
        margin: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        max-width: calc(100% - 20px);
        max-height: calc(100% - 20px);
        width: auto;
        height: auto;
        border-radius: 10px;
        background-color: white;
      }
      #currentPage.flipping-right {
        transform-origin: left center;
        animation: flipRight 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #currentPage.flipping-left {
        transform-origin: left center;
        animation: flipLeft 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes flipRight {
        0% {
          transform: rotateY(0deg) translateZ(0);
          box-shadow: -5px 0 25px rgba(0,0,0,0.1);
        }
        50% {
          transform: rotateY(-90deg) translateZ(100px);
          box-shadow: -15px 0 35px rgba(0,0,0,0.2);
        }
        100% {
          transform: rotateY(-180deg) translateZ(0);
          box-shadow: -5px 0 25px rgba(0,0,0,0.1);
        }
      }
      @keyframes flipLeft {
        0% {
          transform: rotateY(-90deg) translateZ(100px);
          box-shadow: 5px 0 25px rgba(0,0,0,0.1);
        }
        100% {
          transform: rotateY(0deg) translateZ(0);
          box-shadow: 5px 0 25px rgba(0,0,0,0.1);
        }
      }
      #statusOverlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 24px;
        background: rgba(26, 38, 52, 0.92);
        z-index: 50;
        text-align: center;
      }
      #statusSpinner {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 4px solid rgba(255, 255, 255, 0.25);
        border-top-color: #3498db;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      #statusText {
        color: white;
        font-size: 16px;
        white-space: pre-line;
        max-width: 320px;
      }
      #retryButton {
        display: none;
        margin: 0 15px;
        padding: 10px 20px;
        background: linear-gradient(145deg, #3498db, #2980b9);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div id="controls">
      <button id="prev" disabled>Previous</button>
      <span id="pageInfo">Page: ${safeInitialPage}</span>
      <button id="next" disabled>Next</button>
    </div>
    <div id="viewer">
      <div id="currentPage" class="page-wrapper"></div>
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
      (function () {
        function post(message) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        }

        function describeError(err) {
          if (!err) return "Unknown error";
          return err.message || String(err);
        }

        // Assigned to a fixed local name from a source-string constant (see
        // pdfRenderScale.ts). We deliberately do NOT use
        // Function.prototype.toString() to obtain this source, because under
        // Hermes that returns a "[bytecode]" placeholder rather than the real
        // function body.
        var computeRenderScale = (${computeRenderScaleSource});

        try {
          var workerSource = ${workerSourceLiteral};
          var workerBlob = new Blob([workerSource], { type: "application/javascript" });
          pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
        } catch (workerInitError) {
          post({ type: "error", message: "Failed to initialize PDF worker: " + describeError(workerInitError) });
          return;
        }

        var PDF_URL = ${pdfUrlLiteral};
        var currentPage = ${safeInitialPage};
        var pdfDoc = null;
        var isAnimating = false;

        var viewerEl = document.getElementById("viewer");
        var pageInfoEl = document.getElementById("pageInfo");
        var prevBtn = document.getElementById("prev");
        var nextBtn = document.getElementById("next");
        var overlayEl = document.getElementById("statusOverlay");
        var statusTextEl = document.getElementById("statusText");
        var retryBtn = document.getElementById("retryButton");

        function showOverlay(text, showRetry) {
          overlayEl.style.display = "flex";
          statusTextEl.textContent = text;
          retryBtn.style.display = showRetry ? "inline-block" : "none";
        }

        function hideOverlay() {
          overlayEl.style.display = "none";
        }

        function renderCanvas(num) {
          return pdfDoc.getPage(num).then(function (page) {
            var baseViewport = page.getViewport({ scale: 1 });
            var containerWidth = viewerEl.clientWidth || baseViewport.width;
            var scale = computeRenderScale({
              pageWidthPt: baseViewport.width,
              pageHeightPt: baseViewport.height,
              containerWidthPx: containerWidth,
              devicePixelRatio: window.devicePixelRatio || 1,
            });
            var viewport = page.getViewport({ scale: scale });

            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            return page.render({ canvasContext: context, viewport: viewport }).promise.then(function () {
              return canvas;
            });
          });
        }

        function updatePage(num) {
          return renderCanvas(num).then(function (canvas) {
            var currentPageDiv = document.getElementById("currentPage");
            currentPageDiv.innerHTML = "";
            currentPageDiv.appendChild(canvas);
            pageInfoEl.textContent = "Page: " + num + " / " + pdfDoc.numPages;
            post({ type: "pageChange", page: num });
          });
        }

        function handlePageChange(newPage, direction) {
          if (isAnimating || !pdfDoc) return;
          isAnimating = true;

          var currentPageDiv = document.getElementById("currentPage");
          currentPageDiv.className =
            "page-wrapper flipping-" + (direction || (newPage > currentPage ? "right" : "left"));

          currentPage = newPage;
          updatePage(currentPage)
            .catch(function (err) {
              post({ type: "error", message: "Failed to render page: " + describeError(err) });
            })
            .then(function () {
              setTimeout(function () {
                currentPageDiv.className = "page-wrapper";
                isAnimating = false;
              }, 800);
            });
        }

        prevBtn.onclick = function () {
          if (!pdfDoc || currentPage <= 1 || isAnimating) return;
          handlePageChange(currentPage - 1, "left");
        };

        nextBtn.onclick = function () {
          if (!pdfDoc || currentPage >= pdfDoc.numPages || isAnimating) return;
          handlePageChange(currentPage + 1, "right");
        };

        var touchStartX = 0;
        var touchStartY = 0;
        var touchStartTime = 0;

        viewerEl.addEventListener("touchstart", function (e) {
          if (isAnimating) return;
          touchStartTime = Date.now();
          touchStartY = e.touches[0].clientY;
          touchStartX = e.touches[0].clientX;
        });

        viewerEl.addEventListener("touchend", function (e) {
          if (isAnimating || !pdfDoc) return;
          var touchEndX = e.changedTouches[0].clientX;
          var touchEndY = e.changedTouches[0].clientY;
          var touchEndTime = Date.now();

          var diffX = touchStartX - touchEndX;
          var diffY = Math.abs(touchStartY - touchEndY);
          var timeDiff = touchEndTime - touchStartTime;

          if (Math.abs(diffX) > diffY && Math.abs(diffX) > 50 && timeDiff < 300) {
            if (diffX > 0 && currentPage < pdfDoc.numPages) {
              handlePageChange(currentPage + 1, "right");
            } else if (diffX < 0 && currentPage > 1) {
              handlePageChange(currentPage - 1, "left");
            }
          }
        });

        function loadPdfDocument() {
          pdfDoc = null;
          isAnimating = false;
          prevBtn.disabled = true;
          nextBtn.disabled = true;
          showOverlay("Loading PDF…", false);

          var loadingTask = pdfjsLib.getDocument({ url: PDF_URL });
          loadingTask.onProgress = function (progress) {
            if (progress && progress.total) {
              var pct = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
              showOverlay("Loading PDF… " + pct + "%", false);
              post({ type: "progress", loaded: progress.loaded, total: progress.total });
            }
          };

          loadingTask.promise
            .then(function (doc) {
              pdfDoc = doc;
              prevBtn.disabled = false;
              nextBtn.disabled = false;
              return updatePage(currentPage);
            })
            .then(function () {
              hideOverlay();
              post({ type: "ready", numPages: pdfDoc.numPages });
            })
            .catch(function (err) {
              var message = describeError(err);
              showOverlay("Couldn't load this PDF.\\n" + message, true);
              post({ type: "error", message: message });
            });
        }

        retryBtn.onclick = function () {
          loadPdfDocument();
        };

        loadPdfDocument();
      })();
    </script>
  </body>
</html>
`;
}
