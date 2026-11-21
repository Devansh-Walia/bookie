/**
 * Builds the JavaScript that runs inside the PDF viewer WebView.
 *
 * Kept separate from the HTML/CSS (see pdfViewerHtml.ts / pdfViewerStyles.ts)
 * so the reader logic is readable and independently testable. All dynamic
 * values are passed in already-serialized (JSON-escaped) so this function is
 * a pure string builder with no knowledge of the PDF.js sources.
 */
export interface ViewerScriptParams {
  /** JSON-stringified PDF URL literal (already escaped). */
  pdfUrlLiteral: string;
  /** JSON-stringified worker source literal (already escaped). */
  workerSourceLiteral: string;
  /** Initial page number. */
  safeInitialPage: number;
  /** JSON-stringified bookmarks array. */
  bookmarksLiteral: string;
  /** JSON-stringified highlights array. */
  highlightsLiteral: string;
  /** Source text of the computeRenderScale function. */
  computeRenderScaleSource: string;
  /** Source text of the page-curl geometry module (pageCurl.ts). */
  pageCurlSource: string;
}

export function buildViewerScript({
  pdfUrlLiteral,
  workerSourceLiteral,
  safeInitialPage,
  bookmarksLiteral,
  highlightsLiteral,
  computeRenderScaleSource,
  pageCurlSource,
}: ViewerScriptParams): string {
  return `(function () {
  function post(message) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }
  function describeError(err) {
    if (!err) return "Unknown error";
    return err.message || String(err);
  }
  var computeRenderScale = (${computeRenderScaleSource});
  var Curl = ${pageCurlSource};

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
  // Page turn timing/feel (see pageCurl.ts for where these come from).
  var FLIP_MS = 560;
  var CURL_LIFT = 0.05;
  var FOLLOW = 0.22;
  var MAX_ZOOM = 4;
  // Room around the page. Phones get the whole screen (the page runs edge to
  // edge); wider viewports keep a margin so the floating controls and the
  // page edge stay apart. Mirrored into CSS by applyPageInset().
  var COMPACT_MAX_WIDTH = 700;
  var PAGE_INSET_WIDE = { x: 44, top: 28, bottom: 92 };
  var PAGE_INSET_COMPACT = { x: 0, top: 0, bottom: 0 };
  var MAX_CACHE = 6;
  var pageCache = new Map();

  var bookmarks = ${bookmarksLiteral};
  var highlights = ${highlightsLiteral};

  var HIGHLIGHT_COLORS = [
    "rgba(250, 204, 21, 0.45)",
    "rgba(74, 222, 128, 0.45)",
    "rgba(96, 165, 250, 0.45)",
    "rgba(244, 114, 182, 0.45)"
  ];

  var viewerEl = document.getElementById("viewer");
  var pageFrontEl = document.getElementById("pageFront");
  var pageBackEl = document.getElementById("pageBack");
  var stageEl = document.getElementById("stage");
  var underClipEl = document.getElementById("underClip");
  var underShadeEl = document.getElementById("underShade");
  var flapClipEl = document.getElementById("flapClip");
  var flapCastEl = document.getElementById("flapCast");
  var flapEl = document.getElementById("flap");
  var flapCanvas = document.getElementById("flapCanvas");
  var flapShadeEl = document.getElementById("flapShade");
  var pageInfoEl = document.getElementById("pageInfo");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var overlayEl = document.getElementById("statusOverlay");
  var statusTextEl = document.getElementById("statusText");
  var retryBtn = document.getElementById("retryButton");
  var bookmarkRibbon = document.getElementById("bookmarkRibbon");
  var highlightToolbar = document.getElementById("highlightToolbar");

  function showOverlay(text, showRetry) {
    overlayEl.style.display = "flex";
    statusTextEl.textContent = text;
    retryBtn.style.display = showRetry ? "block" : "none";
  }
  function hideOverlay() { overlayEl.style.display = "none"; }

  function cacheGet(num) {
    if (!pageCache.has(num)) return null;
    var el = pageCache.get(num);
    pageCache.delete(num);
    pageCache.set(num, el);
    return el;
  }
  function cacheSet(num, el) {
    pageCache.delete(num);
    pageCache.set(num, el);
    while (pageCache.size > MAX_CACHE) pageCache.delete(pageCache.keys().next().value);
  }

  function makeId() {
    return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function renderHighlights(pageNum, layer, cssWidth, cssHeight) {
    layer.innerHTML = "";
    highlights.forEach(function (h) {
      if (h.page !== pageNum) return;
      (h.rects || []).forEach(function (r) {
        var d = document.createElement("div");
        d.className = "hl-rect";
        d.style.left = (r.x * cssWidth) + "px";
        d.style.top = (r.y * cssHeight) + "px";
        d.style.width = (r.width * cssWidth) + "px";
        d.style.height = (r.height * cssHeight) + "px";
        d.style.backgroundColor = h.color;
        d.setAttribute("data-hl", h.id);
        layer.appendChild(d);
      });
    });
  }

  // The inset for the current viewport, mirrored into CSS so .page-layer's
  // padding matches the fit maths below.
  function pageInset() {
    var w = viewerEl.clientWidth || 0;
    return w > 0 && w <= COMPACT_MAX_WIDTH ? PAGE_INSET_COMPACT : PAGE_INSET_WIDE;
  }

  function applyPageInset() {
    var inset = pageInset();
    viewerEl.style.setProperty("--page-inset-x", inset.x + "px");
    viewerEl.style.setProperty("--page-inset-top", inset.top + "px");
    viewerEl.style.setProperty("--page-inset-bottom", inset.bottom + "px");
    viewerEl.classList.toggle("compact", inset === PAGE_INSET_COMPACT);
    return inset;
  }

  function renderPage(num) {
    var cached = cacheGet(num);
    if (cached) return Promise.resolve(cached);
    return pdfDoc.getPage(num).then(function (page) {
      var baseViewport = page.getViewport({ scale: 1 });
      // Fit the page inside the viewport minus the inset, so on a phone the
      // page fills the screen and on wider screens it keeps its margin.
      var inset = pageInset();
      var cw = Math.max(80, (viewerEl.clientWidth || baseViewport.width) - inset.x * 2);
      var ch = Math.max(80, (viewerEl.clientHeight || baseViewport.height) - inset.top - inset.bottom);
      var fitScale = Math.min(cw / baseViewport.width, ch / baseViewport.height);
      var renderScale = computeRenderScale({
        pageWidthPt: baseViewport.width,
        pageHeightPt: baseViewport.height,
        containerWidthPx: baseViewport.width * fitScale,
        devicePixelRatio: window.devicePixelRatio || 1
      });
      var cssWidth = baseViewport.width * fitScale;
      var cssHeight = baseViewport.height * fitScale;
      var renderViewport = page.getViewport({ scale: renderScale });
      var textViewport = page.getViewport({ scale: fitScale });

      var container = document.createElement("div");
      container.className = "page-container";
      container.style.width = cssWidth + "px";
      container.style.height = cssHeight + "px";

      var canvas = document.createElement("canvas");
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = cssWidth + "px";
      canvas.style.height = cssHeight + "px";
      container.appendChild(canvas);

      var hlLayer = document.createElement("div");
      hlLayer.className = "hl-layer";
      container.appendChild(hlLayer);

      var textLayer = document.createElement("div");
      textLayer.className = "textLayer";
      textLayer.style.setProperty("--scale-factor", String(fitScale));
      container.appendChild(textLayer);

      return page.render({ canvasContext: canvas.getContext("2d"), viewport: renderViewport }).promise.then(function () {
        try {
          page.getTextContent().then(function (tc) {
            if (pdfjsLib.renderTextLayer) {
              pdfjsLib.renderTextLayer({ textContentSource: tc, container: textLayer, viewport: textViewport });
            }
          }).catch(function () {});
        } catch (e) {}
        renderHighlights(num, hlLayer, cssWidth, cssHeight);
        cacheSet(num, container);
        return container;
      });
    });
  }

  function setPageInfo(num) {
    pageInfoEl.textContent = "Page " + num + " / " + pdfDoc.numPages;
  }

  function updateBookmarkRibbon() {
    var bm = null;
    for (var i = 0; i < bookmarks.length; i++) {
      if (bookmarks[i].page === currentPage) { bm = bookmarks[i]; break; }
    }
    if (bm) {
      bookmarkRibbon.textContent = bm.icon;
      bookmarkRibbon.style.display = "flex";
    } else {
      bookmarkRibbon.style.display = "none";
    }
  }

  function afterPageChange() {
    updateBookmarkRibbon();
  }

  function preloadNeighbors(num) {
    [num - 1, num + 1].forEach(function (n) {
      if (pdfDoc && n >= 1 && n <= pdfDoc.numPages) renderPage(n).catch(function () {});
    });
  }

  function showPage(num) {
    return renderPage(num).then(function (container) {
      pageFrontEl.innerHTML = "";
      pageBackEl.innerHTML = "";
      pageFrontEl.appendChild(container);
      setPageInfo(num);
      post({ type: "pageChange", page: num });
      afterPageChange();
      preloadNeighbors(num);
    });
  }

  function commitPage(num) {
    currentPage = num;
    setPageInfo(num);
    post({ type: "pageChange", page: num });
    afterPageChange();
    preloadNeighbors(num);
  }

  // ---- Page curl -----------------------------------------------------------
  // A turn is one "curl": the sheet being turned sits in #pageFront and is
  // clipped to the part still lying flat, the page it uncovers sits in
  // #pageBack, and #flap shows the lifted part mirrored across the fold line
  // (the back of the sheet). Forward turns fold the current page away to the
  // left; backward turns unfold the previous page back over the current one.

  var reduceMotion = false;
  try {
    reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) {}

  var raf = window.requestAnimationFrame
    ? function (fn) { return window.requestAnimationFrame(fn); }
    : function (fn) { return setTimeout(fn, 16); };
  function nowMs() { return Date.now(); }

  var curl = null;
  var curlLoopQueued = false;
  var flipToken = 0;
  var pendingFlip = null;

  function pageBox(container) {
    return {
      ox: container.offsetLeft || 0,
      oy: container.offsetTop || 0,
      W: parseFloat(container.style.width) || container.clientWidth || 1,
      H: parseFloat(container.style.height) || container.clientHeight || 1
    };
  }

  function px(n) { return (Math.round(n * 100) / 100) + "px"; }

  function polygonCss(points, ox, oy) {
    if (!points || points.length < 3) return "polygon(0px 0px, 0px 0px, 0px 0px)";
    var parts = [];
    for (var i = 0; i < points.length; i++) parts.push(px(points[i].x + ox) + " " + px(points[i].y + oy));
    return "polygon(" + parts.join(", ") + ")";
  }

  function setClip(el, value) {
    el.style.clipPath = value;
    el.style.webkitClipPath = value;
  }

  function placeBox(el, box) {
    el.style.left = px(box.ox);
    el.style.top = px(box.oy);
    el.style.width = px(box.W);
    el.style.height = px(box.H);
  }

  // The back of the sheet shows the page faintly through the paper. A
  // half-resolution copy is plenty for that and keeps memory down.
  function copyToFlap(container) {
    var src = container.querySelector("canvas");
    if (!src) return;
    flapCanvas.width = Math.max(1, Math.round(src.width / 2));
    flapCanvas.height = Math.max(1, Math.round(src.height / 2));
    var ctx = flapCanvas.getContext ? flapCanvas.getContext("2d") : null;
    if (!ctx) return;
    try { ctx.drawImage(src, 0, 0, flapCanvas.width, flapCanvas.height); } catch (e) {}
  }

  function restPoint(c) {
    return c.forward ? { x: c.C.x, y: c.C.y } : { x: -c.box.W, y: c.C.y };
  }

  function beginCurl(forward, frontEl, backEl, frontNum, backNum, grabY) {
    pageBackEl.innerHTML = "";
    pageFrontEl.innerHTML = "";
    pageBackEl.appendChild(backEl);
    pageFrontEl.appendChild(frontEl);
    var box = pageBox(frontEl);
    var C = { x: box.W, y: Math.max(0, Math.min(box.H, grabY)) };
    curl = {
      forward: forward,
      frontNum: frontNum,
      backNum: backNum,
      box: box,
      C: C,
      P: forward ? { x: C.x, y: C.y } : { x: -box.W, y: C.y },
      target: null,
      mode: "follow",
      anim: null,
      dragging: false,
      hover: false,
      committed: false,
      lastT: 0
    };
    curl.target = { x: curl.P.x, y: curl.P.y };
    copyToFlap(frontEl);
    placeBox(underClipEl, box);
    placeBox(flapClipEl, box);
    flapEl.style.width = px(box.W);
    flapEl.style.height = px(box.H);
    underClipEl.style.display = "block";
    flapClipEl.style.display = "block";
    drawCurl();
    return curl;
  }

  function clearCurlLayers() {
    setClip(pageFrontEl, "");
    underClipEl.style.display = "none";
    flapClipEl.style.display = "none";
    flapCastEl.style.filter = "";
  }

  function shadeBand(el, f, length, depth) {
    el.style.width = px(length);
    el.style.height = px(depth);
    el.style.transform =
      "translate(" + px(f.mid.x) + "," + px(f.mid.y) + ") rotate(" + f.angle.toFixed(3) + "deg) translate(" + px(-length / 2) + ",0px)";
  }

  function drawCurl() {
    var c = curl;
    if (!c) return;
    var b = c.box;
    // Clip to the page itself: outside it, the page underneath already draws
    // the same shadow and page-stack edges (clipping wider would double them).
    var f = Curl.fold(b.W, b.H, c.C, c.P, 0);
    if (!f) {
      setClip(pageFrontEl, "");
      flapEl.style.visibility = "hidden";
      underShadeEl.style.opacity = "0";
      flapCastEl.style.filter = "";
      return;
    }
    setClip(pageFrontEl, polygonCss(f.front, b.ox, b.oy));
    setClip(flapEl, polygonCss(f.folded, 0, 0));
    flapEl.style.visibility = "visible";
    flapEl.style.transform = "matrix(" + f.matrix.map(function (v) { return v.toFixed(5); }).join(",") + ")";
    var length = 2 * (b.W + b.H);
    // Shading on the sheet where it bends over the fold.
    shadeBand(flapShadeEl, f, length, Math.max(24, b.W * 0.5));
    // Shadow the lifted sheet casts on the page it uncovers.
    shadeBand(underShadeEl, f, length, b.W * (0.12 + 0.3 * f.intensity));
    underShadeEl.style.opacity = (0.35 + 0.65 * f.intensity).toFixed(3);
    // Shadow the sheet casts on the flat part of itself.
    flapCastEl.style.filter =
      "drop-shadow(0px 0px " + px(3 + 12 * f.intensity) + " rgba(0,0,0," + (0.18 + 0.32 * f.intensity).toFixed(3) + "))";
  }

  function queueCurlFrame() {
    if (curlLoopQueued) return;
    curlLoopQueued = true;
    raf(curlFrame);
  }

  function curlFrame() {
    curlLoopQueued = false;
    if (!curl) return;
    var more = stepCurl(nowMs());
    if (!curl) return;
    drawCurl();
    if (more) queueCurlFrame();
  }

  function stepCurl(t) {
    var c = curl;
    if (c.anim) {
      var a = c.anim;
      var k = a.dur > 0 ? Math.min(1, (t - a.start) / a.dur) : 1;
      c.P = a.path(k);
      if (k >= 1) {
        finishCurl(a.complete);
        return false;
      }
      return true;
    }
    // Follow the finger/mouse with FlipHTML5's 22%-per-frame smoothing.
    var dt = c.lastT ? Math.max(1, t - c.lastT) : 16.7;
    c.lastT = t;
    var alpha = 1 - Math.pow(1 - FOLLOW, dt / 16.7);
    var target = Curl.clampPoint(c.box.W, c.box.H, c.C, c.target);
    c.P = { x: c.P.x + (target.x - c.P.x) * alpha, y: c.P.y + (target.y - c.P.y) * alpha };
    if (Math.abs(target.x - c.P.x) < 0.5 && Math.abs(target.y - c.P.y) < 0.5) {
      c.P = target;
      if (c.mode === "spring") {
        finishCurl(false);
        return false;
      }
      c.lastT = 0;
      return false;
    }
    return true;
  }

  function animateCurl(to, complete, programmatic) {
    var c = curl;
    var from = { x: c.P.x, y: c.P.y };
    var W = c.box.W;
    var H = c.box.H;
    var share = Math.min(1, Math.abs(to.x - from.x) / (2 * W));
    var dur = reduceMotion ? 0 : programmatic ? FLIP_MS : Math.max(140, FLIP_MS * share);
    var path = programmatic
      ? function (k) { return Curl.autoFlipPoint(W, H, from, to.x, k, CURL_LIFT); }
      : function (k) {
          var e = Curl.easeOutSine(k);
          return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        };
    c.mode = "anim";
    c.anim = { start: nowMs(), dur: dur, path: path, complete: complete };
    queueCurlFrame();
  }

  function springBack() {
    var c = curl;
    if (!c) return;
    c.dragging = false;
    c.hover = false;
    c.anim = null;
    c.mode = "spring";
    c.target = restPoint(c);
    queueCurlFrame();
  }

  function finishCurl(complete) {
    var c = curl;
    if (!c) return;
    curl = null;
    // Forward: completing uncovers the back page. Backward: completing lays
    // the previous page (front) flat again.
    var showFront = c.forward ? !complete : complete;
    var keep = showFront ? pageFrontEl.firstChild : pageBackEl.firstChild;
    clearCurlLayers();
    pageFrontEl.innerHTML = "";
    pageBackEl.innerHTML = "";
    if (keep) pageFrontEl.appendChild(keep);
    if (complete && !c.committed) commitPage(showFront ? c.frontNum : c.backNum);
  }

  // Ends whatever turn is running right away, at the state it was heading to.
  function snapCurl() {
    if (!curl) return;
    finishCurl(curl.anim ? curl.anim.complete : false);
  }

  function basePage() {
    return pendingFlip !== null ? pendingFlip : currentPage;
  }

  // Turns to an adjacent page with an animated curl from a bottom corner
  // (top corner when the user tapped one).
  function flipTo(newPage, fromTop) {
    if (!pdfDoc) return;
    if (newPage < 1 || newPage > pdfDoc.numPages) return;
    snapCurl();
    if (newPage === currentPage) return;
    var from = currentPage;
    var forward = newPage > from;
    var token = ++flipToken;
    pendingFlip = newPage;
    Promise.all([renderPage(from), renderPage(newPage)]).then(function (els) {
      if (token !== flipToken) return;
      pendingFlip = null;
      snapCurl();
      var front = forward ? els[0] : els[1];
      var back = forward ? els[1] : els[0];
      var c = beginCurl(forward, front, back, forward ? from : newPage, forward ? newPage : from, 0);
      c.C.y = fromTop ? 0 : c.box.H;
      c.P = restPoint(c);
      c.committed = true;
      commitPage(newPage);
      animateCurl(forward ? { x: -c.box.W, y: c.C.y } : { x: c.C.x, y: c.C.y }, true, true);
    }).catch(function (err) {
      if (token === flipToken) pendingFlip = null;
      post({ type: "error", message: "Failed to render page: " + describeError(err) });
    });
  }

  function jumpToPage(n) {
    if (!pdfDoc) return;
    if (n < 1 || n > pdfDoc.numPages) return;
    if (n === currentPage && pendingFlip === null) return;
    if (Math.abs(n - currentPage) === 1) { flipTo(n); return; }
    snapCurl();
    flipToken++;
    pendingFlip = null;
    currentPage = n;
    showPage(n).catch(function (err) { post({ type: "error", message: describeError(err) }); });
  }

  function goPrev() {
    if (!pdfDoc) return;
    resetZoom(true);
    var base = basePage();
    if (base <= 1) return;
    flipTo(base - 1);
  }
  function goNext() {
    if (!pdfDoc) return;
    resetZoom(true);
    var base = basePage();
    if (base >= pdfDoc.numPages) return;
    flipTo(base + 1);
  }
  function goFirst() {
    if (!pdfDoc) return;
    resetZoom(true);
    jumpToPage(1);
  }
  function goLast() {
    if (!pdfDoc) return;
    resetZoom(true);
    jumpToPage(pdfDoc.numPages);
  }

  // ---- Zoom (pinch, double-tap, Ctrl/Cmd + wheel) -------------------------
  var zoom = { s: 1, tx: 0, ty: 0 };
  var momentumToken = 0;

  function isZoomed() { return zoom.s > 1.01; }

  function setZoom(s, tx, ty, animate) {
    var w = viewerEl.clientWidth;
    var h = viewerEl.clientHeight;
    s = Math.max(1, Math.min(MAX_ZOOM, s));
    tx = Math.min(0, Math.max(w - w * s, tx));
    ty = Math.min(0, Math.max(h - h * s, ty));
    zoom = { s: s, tx: tx, ty: ty };
    stageEl.style.transition = animate ? "transform 0.28s cubic-bezier(0.2, 0.7, 0.2, 1)" : "none";
    stageEl.style.transform = s === 1 && tx === 0 && ty === 0
      ? ""
      : "translate(" + px(tx) + "," + px(ty) + ") scale(" + (Math.round(s * 1000) / 1000) + ")";
    if (s > 1.01) viewerEl.classList.add("zoomed");
    else viewerEl.classList.remove("zoomed");
  }

  function resetZoom(animate) {
    momentumToken++;
    if (zoom.s !== 1 || zoom.tx !== 0 || zoom.ty !== 0) setZoom(1, 0, 0, animate);
  }

  // Keeps the stage point under (vx, vy) fixed while scaling to s.
  function zoomAround(s, vx, vy, animate) {
    var ax = (vx - zoom.tx) / zoom.s;
    var ay = (vy - zoom.ty) / zoom.s;
    setZoom(s, vx - ax * s, vy - ay * s, animate);
  }

  function toggleZoom(vp) {
    if (isZoomed()) resetZoom(true);
    else { snapCurl(); zoomAround(2, vp.x, vp.y, true); }
  }

  function panBy(dx, dy) {
    setZoom(zoom.s, zoom.tx + dx, zoom.ty + dy, false);
  }

  // Inertial pan after a flick while zoomed: velocity fades out over 320ms.
  function startMomentum(vx, vy) {
    var token = ++momentumToken;
    var start = nowMs();
    var last = start;
    function step() {
      if (token !== momentumToken) return;
      var t = nowMs();
      var k = Math.min(1, (t - start) / 320);
      var dt = t - last;
      last = t;
      panBy(vx * (1 - k) * dt, vy * (1 - k) * dt);
      if (k < 1) raf(step);
    }
    if (Math.abs(vx) + Math.abs(vy) > 0.05) raf(step);
  }

  prevBtn.onclick = goPrev;
  nextBtn.onclick = goNext;

  function closestTag(node, names) {
    var el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== document.body) {
      var tag = el.tagName ? el.tagName.toUpperCase() : "";
      if (names.indexOf(tag) !== -1) return tag;
      el = el.parentNode;
    }
    return "";
  }

  function isTypingTarget(node) {
    if (closestTag(node, ["INPUT", "TEXTAREA", "SELECT"])) return true;
    var el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== document.body) {
      if (el.isContentEditable) return true;
      el = el.parentNode;
    }
    return false;
  }

  function isControlTarget(node) {
    if (closestTag(node, ["BUTTON", "A", "INPUT"])) return true;
    var el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("role") === "button") return true;
      el = el.parentNode;
    }
    return false;
  }

  // Keyboard reader: arrows / PageUp / PageDown / Space turn pages, Home and
  // End jump to the ends, Escape and the letter keys drive the reader chrome
  // (handled by the host through a "shortcut" message).
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    var key = e.key;
    var handled = true;

    if (key === " " || key === "Spacebar") {
      // Space activates a focused control; only turn pages otherwise.
      if (isControlTarget(e.target)) return;
      if (e.shiftKey) goPrev();
      else goNext();
    } else if (
      key === "ArrowRight" || key === "ArrowDown" || key === "PageDown" ||
      key === "j" || key === "l"
    ) {
      goNext();
    } else if (
      key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp" ||
      key === "k" || key === "h"
    ) {
      goPrev();
    } else if (key === "Home") {
      goFirst();
    } else if (key === "End") {
      goLast();
    } else if (key === "Escape") {
      // Escape backs out of a zoom before it closes the book.
      if (isZoomed()) resetZoom(true);
      else post({ type: "shortcut", action: "close" });
    } else if (key === "b" || key === "B") {
      post({ type: "shortcut", action: "bookmark" });
    } else if (key === "t" || key === "T") {
      post({ type: "shortcut", action: "theme" });
    } else if (key === "a" || key === "A") {
      post({ type: "shortcut", action: "annotations" });
    } else {
      handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // ---- Gestures --------------------------------------------------------------
  // Pointer Events cover touch, pen and mouse:
  //  - drag the page (touch: anywhere; mouse: from the outer edge zones) and
  //    it curls under the finger; release to finish or spring back
  //  - hover a corner with the mouse to peel it; click/drag it to turn
  //  - tap the outer 20% of the page to turn
  //  - pinch or double-tap to zoom, drag to pan (with inertia) while zoomed
  //  - mouse wheel turns pages; Ctrl/Cmd + wheel (and trackpad pinch) zooms
  var pointers = {};
  var gesture = null;
  var drag = null;
  var lastTap = null;

  function isUiTarget(node) {
    var el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== viewerEl) {
      var id = el.id;
      if (id === "controls" || id === "highlightToolbar" || id === "statusOverlay" || id === "bookmarkRibbon") return true;
      el = el.parentNode;
    }
    return false;
  }

  function hasSelection() {
    var sel = window.getSelection && window.getSelection();
    return !!(sel && !sel.isCollapsed);
  }

  function clearSelection() {
    if (window.getSelection) {
      var sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
  }

  function viewPoint(e) {
    var r = viewerEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function stagePoint(e) {
    var v = viewPoint(e);
    return { x: (v.x - zoom.tx) / zoom.s, y: (v.y - zoom.ty) / zoom.s };
  }

  // Point relative to the current page, with its size.
  function pageLocal(pt) {
    var el = pageFrontEl.querySelector(".page-container");
    if (!el) return null;
    var b = pageBox(el);
    return { x: pt.x - b.ox, y: pt.y - b.oy, W: b.W, H: b.H };
  }

  function pointerList() {
    var out = [];
    for (var k in pointers) if (Object.prototype.hasOwnProperty.call(pointers, k)) out.push(pointers[k]);
    return out;
  }

  // Forward: the finger holds the grabbed point. Backward: the previous page's
  // edge lives off-page to the left, so the finger holds the fold instead.
  function dragTarget(c, pt) {
    var x = pt.x - c.box.ox;
    var y = pt.y - c.box.oy;
    return c.forward ? { x: x, y: y } : { x: 2 * x - c.C.x, y: 2 * y - c.C.y };
  }

  function grabYFor(local, corner) {
    if (corner) return corner.charAt(0) === "t" ? 0 : local.H;
    // Mid-edge grab: FlipHTML5 nudges the grab point 5px toward the middle.
    var y = local.y > local.H / 2 ? local.y - 5 : local.y + 5;
    return Math.max(1, Math.min(local.H - 1, y));
  }

  // Starts a user-driven curl toward the next (forward) or previous page.
  function startDrag(forward, grabY, startPt, hover) {
    if (!pdfDoc) return null;
    if (curl && !(curl.hover || curl.mode === "spring")) snapCurl();
    var target = forward ? currentPage + 1 : currentPage - 1;
    if (target < 1 || target > pdfDoc.numPages) return null;
    if (curl && (curl.forward !== forward || curl.frontNum !== (forward ? currentPage : target))) snapCurl();
    var d = { forward: forward, released: false, cancelled: false, tap: false, vx: 0, pt: startPt, hover: !!hover };
    var adopt = function (c) {
      d.curl = c;
      c.anim = null;
      c.mode = "follow";
      c.hover = d.hover;
      c.dragging = !d.hover;
      if (d.pt) c.target = dragTarget(c, d.pt);
      queueCurlFrame();
      if (d.released) releaseDrag(d);
    };
    if (curl) {
      // Re-grab a sheet that is peeling or springing back.
      flipToken++;
      pendingFlip = null;
      d.ready = true;
      adopt(curl);
      return d;
    }
    var token = ++flipToken;
    pendingFlip = null;
    var from = currentPage;
    Promise.all([renderPage(from), renderPage(target)]).then(function (els) {
      if (token !== flipToken || d.cancelled) return;
      snapCurl();
      var front = forward ? els[0] : els[1];
      var back = forward ? els[1] : els[0];
      beginCurl(forward, front, back, forward ? from : target, forward ? target : from, grabY);
      d.ready = true;
      adopt(curl);
    }).catch(function () {});
    return d;
  }

  function releaseDrag(d) {
    d.released = true;
    var c = curl;
    if (!d.ready || !c || c !== d.curl) return;
    if (d.cancelled) { springBack(); return; }
    var progress = (c.C.x - c.P.x) / (2 * c.box.W);
    if (d.tap || Curl.shouldCommit(c.forward, progress, d.vx)) {
      c.dragging = false;
      c.hover = false;
      c.committed = true;
      commitPage(c.forward ? c.backNum : c.frontNum);
      animateCurl(c.forward ? { x: -c.box.W, y: c.C.y } : { x: c.C.x, y: c.C.y }, true, false);
    } else {
      springBack();
    }
  }

  function hoverAt(pt) {
    if (isZoomed() || drag || (curl && (curl.dragging || curl.mode === "anim"))) return;
    var local = pageLocal(pt);
    if (curl && curl.hover) {
      var still = Curl.cornerAt(curl.box.W, curl.box.H, pt.x - curl.box.ox, pt.y - curl.box.oy);
      if (still && (still.charAt(1) === "r") === curl.forward) {
        curl.target = dragTarget(curl, pt);
        queueCurlFrame();
      } else {
        springBack();
      }
      return;
    }
    if (!local) return;
    var corner = Curl.cornerAt(local.W, local.H, local.x, local.y);
    if (!corner) return;
    if (curl && curl.mode === "spring" && curl.forward !== (corner.charAt(1) === "r")) return;
    startDrag(corner.charAt(1) === "r", grabYFor(local, corner), pt, true);
  }

  function startPinch() {
    if (drag) { drag.cancelled = true; releaseDrag(drag); drag = null; }
    momentumToken++;
    lastTap = null;
    var pts = pointerList();
    var mx = (pts[0].x + pts[1].x) / 2;
    var my = (pts[0].y + pts[1].y) / 2;
    var dist = Math.max(10, Math.sqrt(Math.pow(pts[0].x - pts[1].x, 2) + Math.pow(pts[0].y - pts[1].y, 2)));
    gesture = {
      type: "pinch",
      d0: dist,
      s0: zoom.s,
      ax: (mx - zoom.tx) / zoom.s,
      ay: (my - zoom.ty) / zoom.s
    };
  }

  function updatePinch() {
    var pts = pointerList();
    if (pts.length < 2) return;
    var mx = (pts[0].x + pts[1].x) / 2;
    var my = (pts[0].y + pts[1].y) / 2;
    var dist = Math.sqrt(Math.pow(pts[0].x - pts[1].x, 2) + Math.pow(pts[0].y - pts[1].y, 2));
    var s = Math.max(1, Math.min(MAX_ZOOM, gesture.s0 * (dist / gesture.d0)));
    setZoom(s, mx - gesture.ax * s, my - gesture.ay * s, false);
  }

  function endPinch() {
    gesture = { type: "ignore" };
    if (zoom.s < 1.05) resetZoom(true);
  }

  function handleTap(g, e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("hl-rect")) return;
    if (hasSelection()) return;
    var now = nowMs();
    var vp = viewPoint(e);
    // Double tap zooms (touch/pen; on desktop double-click keeps selecting a word).
    if (g.pointerType !== "mouse" && lastTap && now - lastTap.t < 300 &&
        Math.abs(vp.x - lastTap.x) < 40 && Math.abs(vp.y - lastTap.y) < 40) {
      lastTap = null;
      toggleZoom(vp);
      return;
    }
    if (!isZoomed() && g.edge) {
      lastTap = null;
      var top = !!(g.corner && g.corner.charAt(0) === "t");
      if (g.edge === "next") { if (basePage() < pdfDoc.numPages) flipTo(basePage() + 1, top); }
      else if (basePage() > 1) flipTo(basePage() - 1, top);
      return;
    }
    lastTap = { t: now, x: vp.x, y: vp.y };
  }

  function capture(e) {
    try { if (viewerEl.setPointerCapture) viewerEl.setPointerCapture(e.pointerId); } catch (err) {}
  }

  viewerEl.addEventListener("pointerdown", function (e) {
    if (!pdfDoc) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isUiTarget(e.target)) return;
    pointers[e.pointerId] = viewPoint(e);
    var count = pointerList().length;
    if (count === 2) { startPinch(); return; }
    if (count > 2) return;
    var now = nowMs();
    var pt = stagePoint(e);
    gesture = {
      type: isZoomed() ? "pan" : "pending",
      id: e.pointerId,
      pointerType: e.pointerType || "mouse",
      startX: e.clientX,
      startY: e.clientY,
      startT: now,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: now,
      vx: 0,
      vy: 0,
      moved: false,
      corner: null,
      edge: null
    };
    if (gesture.type === "pan") { momentumToken++; return; }
    var local = pageLocal(pt);
    if (local) {
      gesture.corner = Curl.cornerAt(local.W, local.H, local.x, local.y);
      gesture.edge = Curl.edgeAt(local.W, local.H, local.x, local.y);
      gesture.local = local;
    }
    // Pressing a peeled corner grabs it.
    if (curl && curl.hover && gesture.corner && (gesture.corner.charAt(1) === "r") === curl.forward) {
      drag = startDrag(curl.forward, curl.C.y, pt, false);
      if (drag) { gesture.type = "curl"; capture(e); }
    }
  });

  viewerEl.addEventListener("pointermove", function (e) {
    if (pointers[e.pointerId]) pointers[e.pointerId] = viewPoint(e);
    if (gesture && gesture.type === "pinch") { updatePinch(); return; }
    if (!gesture || gesture.id !== e.pointerId) {
      if (!gesture && e.pointerType === "mouse" && !e.buttons && pdfDoc) hoverAt(stagePoint(e));
      return;
    }
    var g = gesture;
    var now = nowMs();
    var dt = Math.max(1, now - g.lastT);
    var mx = e.clientX - g.lastX;
    var my = e.clientY - g.lastY;
    g.vx = 0.7 * g.vx + 0.3 * (mx / dt);
    g.vy = 0.7 * g.vy + 0.3 * (my / dt);
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    g.lastT = now;
    var tdx = e.clientX - g.startX;
    var tdy = e.clientY - g.startY;
    if (Math.abs(tdx) > 8 || Math.abs(tdy) > 8) g.moved = true;

    if (g.type === "pan") { panBy(mx, my); return; }

    if (g.type === "pending") {
      if (!g.moved) return;
      if (hasSelection()) { g.type = "ignore"; return; }
      // A long press before moving is the platform's text selection.
      if (g.pointerType !== "mouse" && now - g.startT > 450) { g.type = "ignore"; return; }
      var horizontal = Math.abs(tdx) > 20 && Math.abs(tdx) > Math.abs(tdy) * 1.2;
      if (!g.corner && !horizontal) {
        if (Math.abs(tdy) > 20) g.type = "ignore";
        return;
      }
      // With a mouse, a drag over the text selects it; only the edges turn.
      if (g.pointerType === "mouse" && !g.edge) { g.type = "ignore"; return; }
      var forward = g.corner ? g.corner.charAt(1) === "r" : tdx < 0;
      var local = g.local || pageLocal(stagePoint(e));
      if (!local) { g.type = "ignore"; return; }
      var cornerForDir = g.corner && (g.corner.charAt(1) === "r") === forward ? g.corner : null;
      drag = startDrag(forward, grabYFor(local, cornerForDir), stagePoint(e), false);
      if (!drag) { g.type = "ignore"; return; }
      g.type = "curl";
      clearSelection();
      document.body.classList.add("curling");
      capture(e);
      return;
    }

    if (g.type === "curl" && drag) {
      drag.pt = stagePoint(e);
      drag.vx = g.vx;
      if (curl && curl.dragging && curl === drag.curl) {
        curl.target = dragTarget(curl, drag.pt);
        queueCurlFrame();
      }
    }
  });

  function endPointer(e, cancelled) {
    var had = !!pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (!gesture) return;
    if (gesture.type === "pinch") {
      if (pointerList().length < 2) endPinch();
      return;
    }
    if (gesture.type === "ignore") {
      if (pointerList().length === 0) gesture = null;
      return;
    }
    if (gesture.id !== e.pointerId || !had) return;
    var g = gesture;
    gesture = null;
    document.body.classList.remove("curling");
    if (nowMs() - g.lastT > 100) { g.vx = 0; g.vy = 0; }

    if (g.type === "pan") {
      if (g.moved && !cancelled) startMomentum(g.vx, g.vy);
      else if (!cancelled) handleTap(g, e);
      return;
    }
    if (g.type === "curl") {
      var d = drag;
      drag = null;
      if (!d) return;
      d.vx = g.vx;
      d.tap = !g.moved;
      d.cancelled = !!cancelled;
      releaseDrag(d);
      return;
    }
    if (g.type === "pending" && !cancelled && !g.moved && nowMs() - g.startT < 350) handleTap(g, e);
  }

  viewerEl.addEventListener("pointerup", function (e) { endPointer(e, false); });
  viewerEl.addEventListener("pointercancel", function (e) { endPointer(e, true); });
  viewerEl.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse" && !gesture && curl && curl.hover) springBack();
  });

  var lastWheel = 0;
  viewerEl.addEventListener("wheel", function (e) {
    if (!pdfDoc || isUiTarget(e.target)) return;
    e.preventDefault();
    var vp = viewPoint(e);
    if (e.ctrlKey || e.metaKey) {
      zoomAround(zoom.s * Math.exp(-e.deltaY * 0.01), vp.x, vp.y, false);
      return;
    }
    if (isZoomed()) { panBy(-e.deltaX, -e.deltaY); return; }
    // One turn per wheel gesture: events closer than 150ms belong to the same
    // scroll (FlipHTML5 throttles wheel flips the same way).
    var now = nowMs();
    var gap = now - lastWheel;
    lastWheel = now;
    if (gap < 150) return;
    var delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) < 2) return;
    if (curl && curl.mode === "anim") return;
    if (delta > 0) goNext();
    else goPrev();
  }, { passive: false });

  function findTextLayer(node) {
    var el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== viewerEl) {
      if (el.classList && el.classList.contains("textLayer")) return el;
      el = el.parentNode;
    }
    return null;
  }

  function selectionRects(range, textLayerEl) {
    var container = textLayerEl.parentNode;
    var cr = container.getBoundingClientRect();
    var w = container.clientWidth;
    var h = container.clientHeight;
    var rects = [];
    var list = range.getClientRects();
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.width < 1 && r.height < 1) continue;
      rects.push({
        x: (r.left - cr.left) / w,
        y: (r.top - cr.top) / h,
        width: r.width / w,
        height: r.height / h
      });
    }
    return rects;
  }

  var activeRange = null;
  var activeTextLayer = null;

  function refreshToolbar() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      highlightToolbar.classList.remove("show");
      activeRange = null;
      activeTextLayer = null;
      return;
    }
    var range = sel.getRangeAt(0);
    var tl = findTextLayer(range.commonAncestorContainer);
    if (!tl) {
      highlightToolbar.classList.remove("show");
      activeRange = null;
      activeTextLayer = null;
      return;
    }
    activeRange = range;
    activeTextLayer = tl;
    highlightToolbar.classList.add("show");
  }

  document.addEventListener("selectionchange", refreshToolbar);

  function applyHighlight(color) {
    if (!activeRange || !activeTextLayer) return;
    var rects = selectionRects(activeRange, activeTextLayer);
    if (!rects.length) return;
    var text = String(activeRange.toString()).trim();
    var id = makeId();
    var hl = { id: id, page: currentPage, text: text, color: color, rects: rects };
    highlights.push(hl);
    var container = activeTextLayer.parentNode;
    var hlLayer = container.querySelector(".hl-layer");
    if (hlLayer) renderHighlights(currentPage, hlLayer, container.clientWidth, container.clientHeight);
    post({ type: "addHighlight", highlight: hl });
    if (window.getSelection) window.getSelection().removeAllRanges();
    highlightToolbar.classList.remove("show");
  }

  var swatches = highlightToolbar.querySelectorAll(".swatch");
  for (var i = 0; i < swatches.length; i++) {
    (function (color) {
      swatches[i].addEventListener("click", function () { applyHighlight(color); });
    })(HIGHLIGHT_COLORS[i]);
  }

  viewerEl.addEventListener("click", function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains("hl-rect")) {
      var id = t.getAttribute("data-hl");
      highlights = highlights.filter(function (h) { return h.id !== id; });
      if (t.parentNode) t.parentNode.removeChild(t);
      post({ type: "removeHighlight", id: id });
    }
  });

  window.__bookie = {
    jumpToPage: function (n) { jumpToPage(n); },
    nextPage: goNext,
    prevPage: goPrev,
    firstPage: goFirst,
    lastPage: goLast,
    setBookmarks: function (list) { bookmarks = list || []; updateBookmarkRibbon(); },
    setTheme: function (name) {
      if (typeof name === "string" && /^[a-z-]+$/.test(name)) document.body.setAttribute("data-theme", name);
    },
    setHighlights: function (list) {
      highlights = list || [];
      var container = pageFrontEl.querySelector(".page-container");
      if (container) {
        var hlLayer = container.querySelector(".hl-layer");
        if (hlLayer) renderHighlights(currentPage, hlLayer, container.clientWidth, container.clientHeight);
      }
    }
  };

  function loadPdfDocument() {
    pdfDoc = null;
    snapCurl();
    flipToken++;
    pendingFlip = null;
    resetZoom(false);
    pageCache.clear();
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
        return showPage(currentPage);
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

  retryBtn.onclick = function () { loadPdfDocument(); };

  // Re-fit the page when the viewport changes (rotation, window resize).
  var lastViewport = { w: 0, h: 0 };
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      var w = viewerEl.clientWidth;
      var h = viewerEl.clientHeight;
      if (!w || !h || (w === lastViewport.w && h === lastViewport.h)) return;
      lastViewport = { w: w, h: h };
      applyPageInset();
      if (!pdfDoc || curl) return;
      snapCurl();
      resetZoom(false);
      pageCache.clear();
      showPage(currentPage).catch(function () {});
    }, 250);
  });

  lastViewport = { w: viewerEl.clientWidth, h: viewerEl.clientHeight };
  applyPageInset();
  loadPdfDocument();
})();`;
}
