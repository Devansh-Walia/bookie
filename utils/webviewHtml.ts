import { File } from "expo-file-system";
import { Platform } from "react-native";
import { viewerCacheDir } from "./files";

/**
 * Writes generated viewer HTML to disk (native) or returns it inline (web)
 * so it can be handed to a WebView `source`.
 *
 * On native the page must be served from a `file://` URL so PDF.js can load
 * the book from the app's document directory.
 */
export async function htmlSource(
  name: string,
  html: string,
): Promise<{ html: string } | { uri: string }> {
  if (Platform.OS === "web") return { html };
  const file = new File(viewerCacheDir(), `${name}.html`);
  await file.write(html);
  return { uri: file.uri };
}

export function removeHtmlSource(name: string) {
  if (Platform.OS === "web") return;
  try {
    const file = new File(viewerCacheDir(), `${name}.html`);
    if (file.exists) file.delete();
  } catch {
    // Cache files are best-effort.
  }
}
