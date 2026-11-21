import { PAGE_CURL_SOURCE, type PageCurlApi } from "./pageCurl";

// Evaluate the exact source injected into the WebView (see pdfRenderScale.test.ts).
// eslint-disable-next-line no-new-func
const Curl = new Function(`return ${PAGE_CURL_SOURCE};`)() as PageCurlApi;

const W = 300;
const H = 400;

function area(poly: { x: number; y: number }[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function apply(m: number[], p: { x: number; y: number }) {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

describe("page curl geometry", () => {
  it("is flat when the grabbed point has not moved", () => {
    expect(Curl.fold(W, H, { x: W, y: H }, { x: W, y: H })).toBeNull();
  });

  it("folds along the perpendicular bisector of the drag", () => {
    // Dragging the bottom-right corner straight left by half the page.
    const f = Curl.fold(W, H, { x: W, y: H }, { x: W / 2, y: H })!;
    expect(f.normal.x).toBeCloseTo(1);
    expect(f.normal.y).toBeCloseTo(0);
    expect(f.mid).toEqual({ x: (3 * W) / 4, y: H });
    // A quarter of the page is lifted, three quarters still lie flat.
    expect(area(f.folded)).toBeCloseTo((W / 4) * H);
    expect(area(f.front)).toBeCloseTo(((3 * W) / 4) * H);
    expect(f.progress).toBeCloseTo(0.25);
    expect(f.intensity).toBeCloseTo(0.5);
  });

  it("mirrors the lifted part across the fold so the corner lands on the finger", () => {
    const C = { x: W, y: H };
    const P = { x: 120, y: 330 };
    const f = Curl.fold(W, H, C, P)!;
    const landed = apply(f.matrix, C);
    expect(landed.x).toBeCloseTo(P.x);
    expect(landed.y).toBeCloseTo(P.y);
    // Points on the fold line stay put.
    const onLine = apply(f.matrix, f.mid);
    expect(onLine.x).toBeCloseTo(f.mid.x);
    expect(onLine.y).toBeCloseTo(f.mid.y);
  });

  it("never lets the sheet tear away from the spine", () => {
    const C = { x: W, y: H };
    const P = Curl.clampPoint(W, H, C, { x: -500, y: -500 });
    // Bottom corner stays within the page width of the bottom of the spine...
    expect(Math.hypot(P.x - 0, P.y - H)).toBeLessThanOrEqual(W + 0.01);
    // ...and within the diagonal of the top of the spine.
    expect(Math.hypot(P.x, P.y)).toBeLessThanOrEqual(Math.hypot(W, H) + 0.01);
    expect(P.x).toBeGreaterThanOrEqual(-W);
  });

  it("finds FlipHTML5's corner zones (20% of the page around each corner)", () => {
    expect(Curl.cornerAt(W, H, W - 5, H - 5)).toBe("br");
    expect(Curl.cornerAt(W, H, W - 5, 5)).toBe("tr");
    expect(Curl.cornerAt(W, H, 5, 5)).toBe("tl");
    expect(Curl.cornerAt(W, H, 5, H - 5)).toBe("bl");
    expect(Curl.cornerAt(W, H, W / 2, H / 2)).toBeNull();
    expect(Curl.cornerAt(W, H, W + 10, H)).toBeNull();
  });

  it("splits the page into turn zones for taps", () => {
    expect(Curl.edgeAt(W, H, W - 10, H / 2)).toBe("next");
    expect(Curl.edgeAt(W, H, 10, H / 2)).toBe("prev");
    expect(Curl.edgeAt(W, H, W / 2, H / 2)).toBeNull();
  });

  it("animates a turn from corner to corner along a shallow arc", () => {
    const from = { x: W, y: H };
    expect(Curl.autoFlipPoint(W, H, from, -W, 0, 0.05)).toEqual({ x: W, y: H });
    const end = Curl.autoFlipPoint(W, H, from, -W, 1, 0.05);
    expect(end.x).toBeCloseTo(-W);
    expect(end.y).toBeCloseTo(H);
    const mid = Curl.autoFlipPoint(W, H, from, -W, 0.5, 0.05);
    expect(mid.x).toBeCloseTo(0);
    expect(mid.y).toBeCloseTo(H - 0.05 * W);
  });

  it("completes a released drag that was still moving toward the turn", () => {
    expect(Curl.shouldCommit(true, 0.1, -0.5)).toBe(true);
    expect(Curl.shouldCommit(true, 0.6, 0.5)).toBe(false);
    expect(Curl.shouldCommit(true, 0.4, 0)).toBe(true);
    expect(Curl.shouldCommit(true, 0.2, 0)).toBe(false);
    expect(Curl.shouldCommit(false, 0.9, 0.5)).toBe(true);
    expect(Curl.shouldCommit(false, 0.5, 0)).toBe(true);
    expect(Curl.shouldCommit(false, 0.9, 0)).toBe(false);
  });
});
