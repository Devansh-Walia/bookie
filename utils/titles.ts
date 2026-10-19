/**
 * Helpers for turning PDF file names / metadata into human-friendly titles.
 */

/** "my_great-book.v2.pdf" -> "My great book v2" */
export function prettifyFileTitle(fileName: string): string {
  let name = fileName.replace(/\.pdf$/i, "");
  // Strip the "<timestamp>-" prefix older versions of the app added.
  name = name.replace(/^\d{12,}-/, "");
  name = name.replace(/[_]+/g, " ");
  // "great-book" -> "great book", but keep a spaced " - " separator.
  name = name.replace(/(\S)-(?=\S)/g, "$1 ");
  name = name.replace(/(\w)\.(?=\w)/g, "$1 ");
  name = name.replace(/\s+/g, " ").replace(/^[\s-]+|[\s-]+$/g, "");
  if (!name) return "Untitled";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const JUNK_TITLES =
  /^(untitled|document\d*|doc\d*|title|book\d*|pdf|microsoft word|slide \d+|\d+)$/i;

/**
 * Cleans the `Title` field from PDF metadata. Returns null when it doesn't
 * look like a real title (empty, generic, a file name, etc.).
 */
export function cleanMetadataTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let title = raw.replace(/\u0000/g, "").trim();
  if (/^[\w-]+\.\w{2,4}$/.test(title)) return null; // looks like a file name
  title = title.replace(/^microsoft (word|powerpoint) - /i, "");
  title = title.replace(/\.(docx?|pptx?|pdf|odt|tex|indd)$/i, "");
  title = title.replace(/\s+/g, " ").trim();
  if (title.length < 3 || title.length > 120) return null;
  if (JUNK_TITLES.test(title)) return null;
  if (!/[a-z]/i.test(title)) return null;
  return title;
}
