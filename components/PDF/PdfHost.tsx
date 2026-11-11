import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { documentDirectoryUri } from "../../utils/files";
import { htmlSource } from "../../utils/webviewHtml";
import type { PdfHostHandle, PdfHostProps } from "./pdfHostTypes";

// react-native-webview's class typing (`WebView<P = undefined>`) collapses its
// props to `never` under TypeScript 6; pin the generic to `{}`.
type BookieWebView = WebView<{}>;
const TypedWebView = WebView as unknown as React.ComponentType<
  React.ComponentProps<typeof WebView<{}>> & { ref?: React.Ref<BookieWebView> }
>;

/**
 * Native PDF host: writes the generated viewer HTML to the document directory
 * and renders it in a WebView.
 *
 * The page must be served from `file://` so PDF.js can read the book from the
 * same directory — see `utils/webviewHtml.ts`.
 */
export const PdfHost = forwardRef<PdfHostHandle, PdfHostProps>(function PdfHost(
  { html, cacheName, reloadKey, onMessage, onError, style },
  ref,
) {
  const webViewRef = useRef<BookieWebView>(null);
  const [source, setSource] = useState<{ uri: string } | null>(null);

  // Callbacks live in refs so a re-render of the parent can't retrigger the
  // (expensive) HTML write.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useImperativeHandle(
    ref,
    () => ({
      inject: (js: string) => {
        webViewRef.current?.injectJavaScript(`${js} true;`);
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setSource(null);

    htmlSource(cacheName, html)
      .then((next) => {
        if (cancelled) return;
        if ("uri" in next) {
          setSource({ uri: next.uri });
        } else {
          onErrorRef.current("Couldn't prepare the reader.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        onErrorRef.current(
          error instanceof Error ? error.message : String(error),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [html, cacheName, reloadKey]);

  if (!source) return null;

  return (
    <TypedWebView
      ref={webViewRef}
      key={reloadKey}
      style={style}
      source={source}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      allowingReadAccessToURL={documentDirectoryUri()}
      onMessage={(event: WebViewMessageEvent) =>
        onMessage(event.nativeEvent.data)
      }
      onError={() => onErrorRef.current("The PDF viewer failed to load.")}
    />
  );
});
