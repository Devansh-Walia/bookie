import { COMPUTE_RENDER_SCALE_SOURCE, RenderScaleInput } from "./pdfRenderScale";

// Evaluate the exact source string that gets injected into the WebView, so
// the tests exercise the real shipped logic (not a separate TS copy). Node's
// `new Function` is available in the jest environment; the RN app itself
// never eval's this - only the WebView runs it, from HTML.
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const computeRenderScale = new Function(
  "input",
  `return (${COMPUTE_RENDER_SCALE_SOURCE})(input);`
) as (input: RenderScaleInput) => number;

describe("computeRenderScale", () => {
  it("fits the page to the container width, boosted by device pixel ratio", () => {
    const scale = computeRenderScale({
      pageWidthPt: 612,
      pageHeightPt: 792,
      containerWidthPx: 400,
      devicePixelRatio: 1,
    });

    expect(scale).toBeCloseTo(400 / 612, 5);
  });

  it("scales up for high device pixel ratios, up to the configured cap", () => {
    const scale = computeRenderScale({
      pageWidthPt: 612,
      pageHeightPt: 792,
      containerWidthPx: 400,
      devicePixelRatio: 3,
      maxDeviceScale: 2,
    });

    // dpr should be clamped to 2, not the raw 3.
    expect(scale).toBeCloseTo((400 / 612) * 2, 5);
  });

  it("caps the total backing-store pixel area for very large pages/DPRs", () => {
    const input = {
      pageWidthPt: 6000,
      pageHeightPt: 8000,
      containerWidthPx: 4000,
      devicePixelRatio: 2,
      maxDeviceScale: 2,
      maxCanvasPixels: 16_000_000,
    };

    const rawScale = (input.containerWidthPx / input.pageWidthPt) * input.devicePixelRatio;
    const scale = computeRenderScale(input);

    const pixelArea =
      input.pageWidthPt * scale * (input.pageHeightPt * scale);

    expect(scale).toBeLessThan(rawScale);
    expect(pixelArea).toBeLessThanOrEqual(input.maxCanvasPixels * 1.01);
  });

  it("does not apply the area cap when under the limit", () => {
    const scale = computeRenderScale({
      pageWidthPt: 612,
      pageHeightPt: 792,
      containerWidthPx: 400,
      devicePixelRatio: 1,
      maxCanvasPixels: 16_000_000,
    });

    expect(scale).toBeCloseTo(400 / 612, 5);
  });

  it("never returns a scale at or below zero for pathological tiny inputs", () => {
    const scale = computeRenderScale({
      pageWidthPt: 1_000_000,
      pageHeightPt: 1_000_000,
      containerWidthPx: 1,
      devicePixelRatio: 1,
      minScale: 0.05,
    });

    expect(scale).toBeGreaterThanOrEqual(0.05);
  });

  it("falls back to safe defaults for invalid page dimensions", () => {
    const scale = computeRenderScale({
      pageWidthPt: 0,
      pageHeightPt: -10,
      containerWidthPx: 400,
      devicePixelRatio: 1,
    });

    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
  });

  it("treats a missing/zero device pixel ratio as 1", () => {
    const scale = computeRenderScale({
      pageWidthPt: 612,
      pageHeightPt: 792,
      containerWidthPx: 400,
      devicePixelRatio: 0,
    });

    expect(scale).toBeCloseTo(400 / 612, 5);
  });
});
