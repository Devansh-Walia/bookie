import type { RefObject } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Types for the platform-specific PDF host. Kept in their own module so
 * `PdfHost.tsx` and `PdfHost.web.tsx` can both import them without resolving
 * each other.
 */

export interface PdfHostHandle {
  /** Runs JavaScript inside the viewer document. */
  inject: (js: string) => void;
}

export interface PdfHostProps {
  /** The full viewer document, from `buildPdfViewerHtml`. */
  html: string;
  /** Cache file name for the generated HTML (native only). */
  cacheName: string;
  /** Change this to force the document to reload. */
  reloadKey: string;
  onMessage: (data: string) => void;
  onError: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}

export type PdfHostRef = RefObject<PdfHostHandle | null>;

/**
 * Defines the `window.ReactNativeWebView` bridge the viewer script posts
 * through. Only injected on web — the native WebView provides its own.
 */
export const WEBVIEW_BRIDGE_PRELUDE = `
window.ReactNativeWebView = {
  postMessage: function (data) {
    try { parent.postMessage(String(data), "*"); } catch (e) {}
  }
};
`;
