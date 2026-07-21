/**
 * Computes a safe render scale (multiplier applied to PDF.js's `scale: 1`
 * viewport) for rendering a single PDF page onto a `<canvas>`.
 *
 * Two goals, in tension with each other:
 *  1. Sharpness: fit the page to the available container width, boosted by
 *     the device's pixel ratio so text/images stay crisp on high-DPI
 *     screens (instead of the old fixed `scale = 1.5` regardless of device
 *     or page size).
 *  2. Memory safety: never let the canvas backing store exceed a pixel-area
 *     budget. Some PDFs (e.g. high-DPI scans) have very large native page
 *     dimensions; rendering those at full device resolution can allocate a
 *     canvas large enough to crash/hang the WebView. If the fit-to-width
 *     scale would exceed the budget, it's scaled back down proportionally.
 *
 * IMPORTANT: this logic is authored as a *source string*
 * (`COMPUTE_RENDER_SCALE_SOURCE`) rather than a normal function, because it
 * is injected verbatim into the PDF viewer's WebView HTML
 * (see pdfViewerHtml.ts). We must NOT recover it via
 * `Function.prototype.toString()` at runtime: under Hermes (the default
 * React Native JS engine in this app) `toString()` returns a
 * `{ [bytecode] }` placeholder instead of the real source, which would
 * inject a broken, no-op function into the WebView.
 *
 * Keeping it as a string means the exact same text is:
 *  - injected into the WebView, and
 *  - evaluated and unit-tested (see pdfRenderScale.test.ts),
 * so there is a single source of truth with no drift.
 *
 * The source must remain self-contained plain JavaScript (no imports,
 * no closures over outer variables, no TypeScript-only syntax).
 */
export interface RenderScaleInput {
  /** Page width at PDF.js `scale: 1`, in PDF user units (~72/inch). */
  pageWidthPt: number;
  /** Page height at PDF.js `scale: 1`, in PDF user units (~72/inch). */
  pageHeightPt: number;
  /** Available viewer width in CSS pixels to fit the page into. */
  containerWidthPx: number;
  /** The device's pixel ratio (`window.devicePixelRatio`). */
  devicePixelRatio: number;
  /** Upper bound applied to devicePixelRatio. Default 2. */
  maxDeviceScale?: number;
  /** Max allowed canvas backing-store pixel area (width*height). Default ~16MP. */
  maxCanvasPixels?: number;
  /** Absolute floor for the returned scale. Default 0.1. */
  minScale?: number;
}

export const COMPUTE_RENDER_SCALE_SOURCE = `function computeRenderScale(input) {
  var pageWidthPt = input.pageWidthPt;
  var pageHeightPt = input.pageHeightPt;
  var containerWidthPx = input.containerWidthPx;
  var devicePixelRatio = input.devicePixelRatio;
  var maxDeviceScale = input.maxDeviceScale;
  var maxCanvasPixels = input.maxCanvasPixels;
  var minScale = input.minScale;

  if (typeof maxDeviceScale !== "number" || !(maxDeviceScale > 0)) {
    maxDeviceScale = 2;
  }
  if (typeof maxCanvasPixels !== "number" || !(maxCanvasPixels > 0)) {
    maxCanvasPixels = 16000000;
  }
  if (typeof minScale !== "number" || !(minScale > 0)) {
    minScale = 0.1;
  }

  var safePageWidth = pageWidthPt > 0 ? pageWidthPt : 1;
  var safePageHeight = pageHeightPt > 0 ? pageHeightPt : 1;
  var safeContainerWidth = containerWidthPx > 0 ? containerWidthPx : safePageWidth;
  var dpr = devicePixelRatio && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (dpr > maxDeviceScale) {
    dpr = maxDeviceScale;
  }

  var scale = (safeContainerWidth / safePageWidth) * dpr;

  var pixelArea = safePageWidth * scale * (safePageHeight * scale);
  if (pixelArea > maxCanvasPixels) {
    var areaScaleFactor = Math.sqrt(maxCanvasPixels / pixelArea);
    scale = scale * areaScaleFactor;
  }

  return scale > minScale ? scale : minScale;
}`;
