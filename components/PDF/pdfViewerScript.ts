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
}

export function buildViewerScript({
  pdfUrlLiteral,
  workerSourceLiteral,
  safeInitialPage,
  bookmarksLiteral,
  highlightsLiteral,
  computeRenderScaleSource,
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
  var FLIP_MS = 560;
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
  var shadowEl = document.getElementById("shadow");
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

  function renderPage(num) {
    var cached = cacheGet(num);
    if (cached) return Promise.resolve(cached);
    return pdfDoc.getPage(num).then(function (page) {
      var baseViewport = page.getViewport({ scale: 1 });
      var cw = viewerEl.clientWidth || baseViewport.width;
      var ch = viewerEl.clientHeight || baseViewport.height;
      var fitScale = Math.min(cw / baseViewport.width, ch / baseViewport.height);
      var renderScale = computeRenderScale({
        pageWidthPt: baseViewport.width,
        pageHeightPt: baseViewport.height,
        containerWidthPx: cw,
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

      var leftStack = document.createElement("div");
      leftStack.className = "book-stack stack-left";
      container.appendChild(leftStack);
      var rightStack = document.createElement("div");
      rightStack.className = "book-stack stack-right";
      container.appendChild(rightStack);

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

  function updateBookThickness() {
    var total = pdfDoc ? pdfDoc.numPages : 1;
    var read = Math.max(0, currentPage - 1);
    var remaining = Math.max(0, total - currentPage);
    var maxW = 26;
    viewerEl.style.setProperty("--stack-left-w", Math.round((read / total) * maxW) + "px");
    viewerEl.style.setProperty("--stack-right-w", Math.round((remaining / total) * maxW) + "px");
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
    updateBookThickness();
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
      pageFrontEl.appendChild(container);
      setPageInfo(num);
      post({ type: "pageChange", page: num });
      afterPageChange();
      preloadNeighbors(num);
    });
  }

  function flipTo(newPage) {
    if (isAnimating || !pdfDoc) return;
    if (newPage < 1 || newPage > pdfDoc.numPages) return;
    if (newPage === currentPage) return;
    isAnimating = true;
    var forward = newPage > currentPage;
    renderPage(newPage).then(function (container) {
      pageBackEl.innerHTML = "";
      pageBackEl.appendChild(container);
      currentPage = newPage;
      setPageInfo(newPage);
      post({ type: "pageChange", page: newPage });
      afterPageChange();
      preloadNeighbors(newPage);
      pageFrontEl.classList.add(forward ? "flip-forward" : "flip-backward");
      shadowEl.classList.add("active");
      setTimeout(function () {
        pageFrontEl.innerHTML = "";
        pageFrontEl.appendChild(container);
        pageBackEl.innerHTML = "";
        pageFrontEl.classList.remove("flip-forward", "flip-backward");
        shadowEl.classList.remove("active");
        isAnimating = false;
      }, FLIP_MS);
    }).catch(function (err) {
      isAnimating = false;
      post({ type: "error", message: "Failed to render page: " + describeError(err) });
    });
  }

  function jumpToPage(n) {
    if (!pdfDoc) return;
    if (n < 1 || n > pdfDoc.numPages) return;
    if (n === currentPage) return;
    if (Math.abs(n - currentPage) === 1) { flipTo(n); return; }
    currentPage = n;
    showPage(n).catch(function (err) { post({ type: "error", message: describeError(err) }); });
  }

  prevBtn.onclick = function () {
    if (!pdfDoc || currentPage <= 1 || isAnimating) return;
    flipTo(currentPage - 1);
  };
  nextBtn.onclick = function () {
    if (!pdfDoc || currentPage >= pdfDoc.numPages || isAnimating) return;
    flipTo(currentPage + 1);
  };

  var tsx = 0, tsy = 0, tst = 0;
  viewerEl.addEventListener("touchstart", function (e) {
    if (isAnimating) return;
    tst = Date.now();
    tsy = e.touches[0].clientY;
    tsx = e.touches[0].clientX;
  }, { passive: true });
  viewerEl.addEventListener("touchend", function (e) {
    if (isAnimating || !pdfDoc) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    var ex = e.changedTouches[0].clientX;
    var ey = e.changedTouches[0].clientY;
    var et = Date.now();
    var dx = tsx - ex;
    var dy = Math.abs(tsy - ey);
    var dt = et - tst;
    if (Math.abs(dx) > dy && Math.abs(dx) > 50 && dt < 300) {
      if (dx > 0 && currentPage < pdfDoc.numPages) flipTo(currentPage + 1);
      else if (dx < 0 && currentPage > 1) flipTo(currentPage - 1);
    }
  }, { passive: true });

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
    isAnimating = false;
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

  loadPdfDocument();
})();`;
}
