/** Pure path helpers (no native modules, safe to unit test). */

/** Last path segment of a URI/path (works for legacy absolute paths too). */
export function baseName(pathOrUri: string): string {
  const clean = pathOrUri.split("?")[0].replace(/\/+$/, "");
  return decodeURIComponent(clean.substring(clean.lastIndexOf("/") + 1));
}

/** Makes a file name safe to store on disk. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "book.pdf"
  );
}
