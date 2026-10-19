/**
 * CSS for the PDF viewer WebView. Kept as a standalone string (no
 * interpolation) so it can be authored and reviewed independently of the
 * HTML/JS that wraps it. See pdfViewerHtml.ts.
 */
export const VIEWER_CSS = `
:root {
  --bg: #0F172A; --surface: #1E293B; --border: #2A3548;
  --text: #F1F5F9; --text-muted: #94A3B8;
  --accent: #8B5CF6; --accent-strong: #6366F1;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%; width: 100%;
  overflow: hidden; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none; user-select: none;
}
#viewer {
  position: relative; height: 100%; width: 100%; overflow: hidden;
  perspective: 1800px;
  background: radial-gradient(120% 120% at 50% 0%, #16202F 0%, #0F172A 70%);
  --stack-left-w: 0px; --stack-right-w: 0px;
}
.page-layer {
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; padding: 24px;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  transform-style: preserve-3d; will-change: transform;
}
#pageBack { z-index: 1; }
#pageFront { z-index: 2; }
#pageFront.flip-forward { transform-origin: left center; animation: flipForward 0.55s cubic-bezier(0.4, 0.1, 0.2, 1) forwards; }
#pageFront.flip-backward { transform-origin: right center; animation: flipBackward 0.55s cubic-bezier(0.4, 0.1, 0.2, 1) forwards; }
@keyframes flipForward { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(-180deg); } }
@keyframes flipBackward { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(180deg); } }

.page-container { position: relative; }
.page-container canvas {
  display: block; border-radius: 6px; background: #fff;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
}
.book-stack {
  position: absolute; top: 3%; bottom: 3%; width: 0; z-index: 0;
  border-radius: 3px; pointer-events: none;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: #cbd5e1;
  background-image: repeating-linear-gradient(180deg,
    rgba(255,255,255,0.85) 0px, rgba(255,255,255,0.85) 1px,
    rgba(100,116,139,0.5) 1px, rgba(100,116,139,0.5) 2px);
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}
.stack-left { left: 0; transform: translateX(-100%); width: var(--stack-left-w); }
.stack-right { right: 0; transform: translateX(100%); width: var(--stack-right-w); }

.hl-layer { position: absolute; inset: 0; z-index: 2; }
.hl-rect { position: absolute; border-radius: 2px; mix-blend-mode: multiply; }

.textLayer {
  position: absolute; top: 0; left: 0; overflow: hidden; z-index: 3;
  line-height: 1; -webkit-text-size-adjust: none; text-size-adjust: none;
  forced-color-adjust: none; transform-origin: 0 0;
  -webkit-user-select: text; user-select: text;
}
.textLayer span, .textLayer br {
  color: transparent; position: absolute; white-space: pre;
  cursor: text; transform-origin: 0% 0%;
}
.textLayer span.markedContent { top: 0; height: 0; }

#shadow {
  position: absolute; inset: 0; z-index: 3; pointer-events: none;
  opacity: 0; transition: opacity 0.25s ease;
  background: linear-gradient(90deg, rgba(0,0,0,0.4) 0%, transparent 45%);
}
#shadow.active { opacity: 1; }

#bookmarkRibbon {
  position: absolute; top: 14px; right: 14px; z-index: 9;
  width: 44px; height: 44px; border-radius: 12px;
  display: none; align-items: center; justify-content: center;
  font-size: 22px; background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}

#highlightToolbar {
  position: absolute; left: 50%; bottom: 88px; z-index: 20;
  transform: translateX(-50%) translateY(8px);
  display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  border-radius: 999px; background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  opacity: 0; pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
#highlightToolbar.show { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
#highlightToolbar .swatch {
  width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
  border: 2px solid rgba(255,255,255,0.35);
}
#highlightToolbar .swatch:active { transform: scale(0.85); }

#controls {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  z-index: 10; display: flex; align-items: center; gap: 6px; padding: 6px;
  border-radius: 999px; background: rgba(30, 41, 59, 0.85);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
}
#controls button {
  width: 44px; height: 44px; border: none; border-radius: 999px;
  background: transparent; color: var(--text); font-size: 22px; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, transform 0.1s ease;
}
#controls button:active { transform: scale(0.9); background: rgba(255,255,255,0.1); }
#controls button:disabled { opacity: 0.3; }
#pageInfo {
  min-width: 96px; text-align: center; font-size: 14px; font-weight: 600;
  letter-spacing: 0.02em; color: var(--text); font-variant-numeric: tabular-nums;
}

#statusOverlay {
  position: absolute; inset: 0; z-index: 50; display: flex;
  flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; padding: 24px; background: rgba(15, 23, 42, 0.94); text-align: center;
}
#statusSpinner {
  width: 44px; height: 44px; border-radius: 50%;
  border: 4px solid rgba(139, 92, 246, 0.2); border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
#statusText { color: var(--text); font-size: 15px; white-space: pre-line; max-width: 320px; line-height: 1.5; }
#retryButton {
  display: none; padding: 12px 28px; border: none; border-radius: 999px;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}
#retryButton:active { transform: scale(0.96); }

/* ---- Reader themes (body[data-theme]) ---------------------------------- */
.page-container canvas { transition: filter 0.35s ease; }
#viewer { transition: background 0.35s ease; }

body[data-theme="sepia"] #viewer {
  background: radial-gradient(120% 120% at 50% 0%, #3A2D20 0%, #2A2118 70%);
}
body[data-theme="sepia"] .page-container canvas {
  filter: sepia(0.5) saturate(1.15) brightness(0.97) contrast(0.94);
}

body[data-theme="night"] #viewer {
  background: radial-gradient(120% 120% at 50% 0%, #111116 0%, #050507 70%);
}
body[data-theme="night"] .page-container canvas {
  filter: invert(0.9) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}
body[data-theme="night"] .hl-rect { mix-blend-mode: screen; opacity: 0.55; }
body[data-theme="night"] .book-stack { filter: brightness(0.35); }

body[data-theme="candlelight"] #viewer {
  background: radial-gradient(110% 90% at 50% 40%, #3B2410 0%, #1A0F06 75%);
}
body[data-theme="candlelight"] .page-container canvas {
  filter: sepia(0.75) saturate(1.35) hue-rotate(-12deg) brightness(0.86) contrast(0.95);
}
body[data-theme="candlelight"] .page-container::after {
  content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  border-radius: 6px;
  background: radial-gradient(90% 70% at 50% 45%, rgba(255, 170, 80, 0.06) 0%, rgba(40, 18, 0, 0.32) 100%);
}
body[data-theme="candlelight"] .book-stack { filter: sepia(0.8) brightness(0.6); }
`;
