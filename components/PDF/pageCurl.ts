/**
 * Page-curl geometry for the reader's page turn, reverse-engineered from the
 * FlipHTML5 flipbook engine (`computePoint` / `FlipBookIntervalManager` /
 * `aroundCorner` in its book.min.js) and adapted to a single page whose
 * spine is the left edge.
 *
 * Model (page-local CSS pixels, origin at the page's top-left, spine at x=0):
 *  - C is the grabbed point on the free (right) edge — a corner, or the point
 *    level with the finger when the page is grabbed mid-edge.
 *  - P is where that point has been dragged to.
 *  - The fold line is the perpendicular bisector of C→P. Everything on C's
 *    side of it is lifted off the page and mirrored across the line (the
 *    "flap", i.e. the back of the sheet); the next page shows underneath.
 *  - P is clamped so the sheet never tears away from the spine: it stays
 *    within |C - spineEnd| of both spine ends (FlipHTML5 does the same).
 *
 * Like pdfRenderScale.ts this is authored as a source string, because it is
 * injected verbatim into the WebView (Hermes can't `toString()` functions).
 * The same text is evaluated by pageCurl.test.ts. It must stay plain,
 * self-contained ES5.
 */
export interface CurlPoint {
  x: number;
  y: number;
}

export interface CurlFold {
  /** Unit normal of the fold line, pointing toward the grabbed edge. */
  normal: CurlPoint;
  /** Midpoint of C→P (a point on the fold line). */
  mid: CurlPoint;
  /** Rotation (deg) that maps local +y onto `normal` (for shading bands). */
  angle: number;
  /** Still-flat part of the page (page rect grown by `pad`). */
  front: CurlPoint[];
  /** Lifted part of the page, before mirroring. */
  folded: CurlPoint[];
  /** CSS `matrix(a,b,c,d,e,f)` that mirrors across the fold line. */
  matrix: number[];
  /** 0 = flat, 1 = the sheet has turned all the way over. */
  progress: number;
  /** Shadow strength: 0 at rest, 1 halfway through the turn. */
  intensity: number;
}

export interface PageCurlApi {
  clampPoint(W: number, H: number, C: CurlPoint, P: CurlPoint): CurlPoint;
  fold(W: number, H: number, C: CurlPoint, P: CurlPoint, pad?: number): CurlFold | null;
  cornerAt(W: number, H: number, x: number, y: number): "tl" | "tr" | "bl" | "br" | null;
  edgeAt(W: number, H: number, x: number, y: number): "next" | "prev" | null;
  autoFlipPoint(W: number, H: number, from: CurlPoint, toX: number, t: number, lift: number): CurlPoint;
  easeOutSine(t: number): number;
  shouldCommit(forward: boolean, progress: number, vx: number): boolean;
}

export const PAGE_CURL_SOURCE = `(function () {
  // FlipHTML5 treats a circle of 20% of the page around each corner as the
  // "corner" (hover peel, drag start, tap to flip).
  var CORNER_RADIUS = 0.2;
  // Taps in the outer 20% of the page turn it.
  var EDGE_ZONE = 0.2;

  function hypot(x, y) { return Math.sqrt(x * x + y * y); }

  function clampPoint(W, H, C, P) {
    var x = Math.max(-W, Math.min(W, P.x));
    var y = P.y;
    var anchors = [{ x: 0, y: 0 }, { x: 0, y: H }];
    for (var pass = 0; pass < 3; pass++) {
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var r = hypot(C.x - a.x, C.y - a.y);
        var dx = x - a.x;
        var dy = y - a.y;
        var d = hypot(dx, dy);
        if (d > r && d > 0) {
          x = a.x + (dx * r) / d;
          y = a.y + (dy * r) / d;
        }
      }
    }
    return { x: x, y: y };
  }

  // Sutherland-Hodgman: keeps the part of poly where sign * (X - M).n <= 0.
  function clipHalfPlane(poly, M, n, sign) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i];
      var b = poly[(i + 1) % poly.length];
      var fa = sign * ((a.x - M.x) * n.x + (a.y - M.y) * n.y);
      var fb = sign * ((b.x - M.x) * n.x + (b.y - M.y) * n.y);
      if (fa <= 0) out.push(a);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
        var t = fa / (fa - fb);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  }

  function rect(x0, y0, x1, y1) {
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  }

  function fold(W, H, C, P, pad) {
    var dx = C.x - P.x;
    var dy = C.y - P.y;
    var len = hypot(dx, dy);
    if (len < 0.5) return null;
    var n = { x: dx / len, y: dy / len };
    var M = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 };
    var p = pad > 0 ? pad : 0;
    // Mirror across the line through M with normal n: X' = X - 2((X-M).n)n
    var k = 2 * (M.x * n.x + M.y * n.y);
    var progress = Math.max(0, Math.min(1, (C.x - P.x) / (2 * W)));
    return {
      normal: n,
      mid: M,
      angle: (Math.atan2(-n.x, n.y) * 180) / Math.PI,
      front: clipHalfPlane(rect(-p, -p, W + p, H + p), M, n, 1),
      folded: clipHalfPlane(rect(0, 0, W, H), M, n, -1),
      matrix: [1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.y, 1 - 2 * n.y * n.y, k * n.x, k * n.y],
      progress: progress,
      // FlipHTML5's PageFlipShadow: strongest halfway through the turn.
      intensity: progress < 0.5 ? 2 * progress : 2 * (1 - progress)
    };
  }

  function cornerAt(W, H, x, y) {
    if (!(W > 0) || !(H > 0)) return null;
    var fx = x / W;
    var fy = y / H;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    function near(cx, cy) {
      var ex = fx - cx;
      var ey = fy - cy;
      return ex * ex + ey * ey <= CORNER_RADIUS * CORNER_RADIUS;
    }
    if (near(1, 0)) return "tr";
    if (near(1, 1)) return "br";
    if (near(0, 0)) return "tl";
    if (near(0, 1)) return "bl";
    return null;
  }

  function edgeAt(W, H, x, y) {
    if (!(W > 0) || !(H > 0) || y < 0 || y > H || x < 0 || x > W) return null;
    if (x >= W * (1 - EDGE_ZONE)) return "next";
    if (x <= W * EDGE_ZONE) return "prev";
    return null;
  }

  function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  function easeOutSine(t) { return Math.sin((t * Math.PI) / 2); }

  // Programmatic turn (keys, buttons, taps): x eases in-out across the page
  // while the corner lifts along a shallow arc, as in FlipHTML5's
  // flipIntervalTmp (y = H - lift * sqrt(W^2 - x^2) for a bottom corner).
  function autoFlipPoint(W, H, from, toX, t, lift) {
    var e = easeInOutSine(Math.max(0, Math.min(1, t)));
    var x = from.x + (toX - from.x) * e;
    var arc = lift * Math.sqrt(Math.max(0, W * W - x * x));
    return { x: x, y: from.y >= H / 2 ? from.y - arc : from.y + arc };
  }

  // On release a drag completes when the finger was still moving toward the
  // turn (FlipHTML5's meetFlipCondition checks the last move direction), or,
  // if the finger had stopped, once the grabbed edge is past the middle of
  // the page (progress 0.25).
  function shouldCommit(forward, progress, vx) {
    var toward = forward ? -vx : vx;
    if (toward > 0.05) return true;
    if (toward < -0.05) return false;
    return forward ? progress > 0.25 : progress < 0.75;
  }

  return {
    clampPoint: clampPoint,
    fold: fold,
    cornerAt: cornerAt,
    edgeAt: edgeAt,
    autoFlipPoint: autoFlipPoint,
    easeOutSine: easeOutSine,
    shouldCommit: shouldCommit
  };
})()`;
