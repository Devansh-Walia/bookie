import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

// Vendored PDF.js UMD builds (see scripts/copy-pdfjs-assets.js), bundled as
// `.txt` assets (registered in metro.config.js) so Metro treats them as raw
// static files instead of trying to parse/execute them as app source.
const pdfLibAsset = require("../assets/pdfjs/pdf.min.txt");
const pdfWorkerAsset = require("../assets/pdfjs/pdf.worker.min.txt");

export interface PdfJsSources {
  /** Source text of the PDF.js main library (pdf.min.js). */
  lib: string;
  /** Source text of the PDF.js worker (pdf.worker.min.js). */
  worker: string;
}

let cachedSources: PdfJsSources | null = null;
let pendingLoad: Promise<PdfJsSources> | null = null;

async function readAssetAsText(moduleAsset: number): Promise<string> {
  const asset = Asset.fromModule(moduleAsset);
  await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error("Unable to resolve local URI for a pdf.js asset");
  }

  if (Platform.OS === "web") {
    // On web, expo-asset resolves to the static server URL directly (no
    // separate "download" step), so we fetch it like any other static file.
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch pdf.js asset "${uri}" (status ${response.status})`
      );
    }
    return await response.text();
  }

  // On native, expo-asset downloads/copies the asset to a local file:// URI.
  return FileSystem.readAsStringAsync(uri);
}

/**
 * Loads (and caches for the lifetime of the app session) the vendored
 * PDF.js library + worker source text so they can be inlined directly into
 * the PDF viewer's WebView HTML. Bundling + inlining avoids depending on a
 * CDN, lets the viewer work fully offline, and sidesteps cross-origin
 * restrictions that would otherwise apply when the HTML page is served from
 * a `file://` origin (required for large-file streaming, see
 * components/PDF/PDFViewer.tsx).
 */
export async function getPdfJsSources(): Promise<PdfJsSources> {
  if (cachedSources) {
    return cachedSources;
  }
  if (!pendingLoad) {
    pendingLoad = Promise.all([
      readAssetAsText(pdfLibAsset),
      readAssetAsText(pdfWorkerAsset),
    ])
      .then(([lib, worker]) => {
        cachedSources = { lib, worker };
        return cachedSources;
      })
      .catch((error) => {
        // Allow retrying on the next call instead of caching a failure.
        pendingLoad = null;
        throw error;
      });
  }
  return pendingLoad;
}
