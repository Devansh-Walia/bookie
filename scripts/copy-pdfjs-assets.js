/**
 * Copies the pre-built PDF.js UMD bundles from `pdfjs-dist` into `assets/pdfjs`
 * as `.txt` files so Metro bundles them as static assets (raw text), instead
 * of trying to parse/execute them as app source modules.
 *
 * These files are inlined into the PDF viewer's WebView HTML at runtime
 * (see components/PDF/pdfViewerHtml.ts / utils/pdfjsAssets.ts) so the app
 * works fully offline and avoids CDN/cross-origin issues.
 *
 * Re-run this (e.g. via `npm run postinstall`) whenever the `pdfjs-dist`
 * version changes.
 */
const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build"
);
const DEST_DIR = path.join(__dirname, "..", "assets", "pdfjs");

const FILES = [
  { from: "pdf.min.js", to: "pdf.min.txt" },
  { from: "pdf.worker.min.js", to: "pdf.worker.min.txt" },
];

function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true });

  for (const { from, to } of FILES) {
    const srcPath = path.join(SOURCE_DIR, from);
    const destPath = path.join(DEST_DIR, to);

    if (!fs.existsSync(srcPath)) {
      console.error(
        `[copy-pdfjs-assets] Missing "${srcPath}". Is pdfjs-dist installed?`
      );
      process.exitCode = 1;
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
    console.log(`[copy-pdfjs-assets] Copied ${from} -> assets/pdfjs/${to}`);
  }
}

main();
