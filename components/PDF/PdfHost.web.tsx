import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet } from "react-native";
import type { PdfHostHandle, PdfHostProps } from "./pdfHostTypes";

/**
 * Web PDF host: the same viewer document, rendered in a same-origin iframe.
 *
 * `srcdoc` iframes inherit the parent's origin, so `contentWindow.eval` is
 * allowed — which gives `inject()` exactly the semantics of the WebView's
 * `injectJavaScript`. The viewer's `window.ReactNativeWebView.postMessage`
 * calls are bridged to `parent.postMessage` by `WEBVIEW_BRIDGE_PRELUDE`,
 * which `PDFViewer` passes to `buildPdfViewerHtml`.
 */

export const PdfHost = forwardRef<PdfHostHandle, PdfHostProps>(function PdfHost(
  { html, reloadKey, onMessage, onError, style },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useImperativeHandle(
    ref,
    () => ({
      inject: (js: string) => {
        const win = frameRef.current?.contentWindow as
          | (Window & typeof globalThis)
          | null
          | undefined;
        if (!win) return;
        try {
          win.eval(`${js} true;`);
        } catch (error) {
          console.warn("Failed to run script in the reader frame", error);
        }
      },
    }),
    [],
  );

  useEffect(() => {
    function handle(event: MessageEvent) {
      // Only trust messages from our own frame.
      if (event.source !== frameRef.current?.contentWindow) return;
      if (typeof event.data !== "string") return;
      onMessageRef.current(event.data);
    }
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  const frameStyle = {
    ...(StyleSheet.flatten(style as never) as React.CSSProperties),
    border: "none",
    width: "100%",
    height: "100%",
    display: "block",
  };

  return (
    <iframe
      key={reloadKey}
      ref={frameRef}
      srcDoc={html}
      title="Bookie reader"
      style={frameStyle}
      onError={() => onError("The PDF viewer failed to load.")}
    />
  );
});
