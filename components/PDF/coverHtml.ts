import { escapeClosingScriptTag } from "./pdfViewerHtml";

export interface BuildCoverHtmlOptions {
  pdfLibSource: string;
  pdfWorkerSource: string;
  pdfUrl: string;
  /** Output cover width in pixels. */
  width?: number;
}

/**
 * HTML for a tiny, invisible WebView that opens a PDF, renders page 1 to a
 * JPEG and reports back `{ type: "cover", dataUrl, numPages, title }`
 * (or `{ type: "coverError", message }`). Used to generate library covers
 * and to learn the page count + metadata title right after import.
 */
export function buildCoverHtml({
  pdfLibSource,
  pdfWorkerSource,
  pdfUrl,
  width = 360,
}: BuildCoverHtmlOptions): string {
  const lib = escapeClosingScriptTag(pdfLibSource);
  const worker = escapeClosingScriptTag(JSON.stringify(pdfWorkerSource));
  const url = escapeClosingScriptTag(JSON.stringify(pdfUrl));
  const targetWidth =
    Number.isFinite(width) && width > 0 ? Math.round(width) : 360;

  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
${lib}
    </script>
    <script>
(function () {
  function post(message) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }
  function fail(err) {
    post({ type: "coverError", message: (err && err.message) || String(err) });
  }
  try {
    var blob = new Blob([${worker}], { type: "application/javascript" });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch (e) { fail(e); return; }

  var TARGET_WIDTH = ${targetWidth};
  pdfjsLib.getDocument({ url: ${url} }).promise.then(function (doc) {
    var titlePromise = doc.getMetadata()
      .then(function (meta) { return (meta && meta.info && meta.info.Title) || null; })
      .catch(function () { return null; });
    return doc.getPage(1).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
        return titlePromise.then(function (title) {
          post({
            type: "cover",
            dataUrl: canvas.toDataURL("image/jpeg", 0.82),
            numPages: doc.numPages,
            title: title
          });
        });
      });
    });
  }).catch(fail);
})();
    </script>
  </body>
</html>
`;
}
