import type { ReaderTheme } from "../types";

/**
 * Reader themes. The actual page styling lives in the WebView CSS
 * (components/PDF/pdfViewerStyles.ts, keyed by `body[data-theme]`); this
 * file holds the metadata the native UI needs (labels, swatches, chrome).
 */
export interface ReaderThemeInfo {
  id: ReaderTheme;
  name: string;
  emoji: string;
  /** Swatch shown in the picker: page color on background color. */
  page: string;
  background: string;
  /** Background behind the native top bar / loading screens. */
  chrome: string;
}

export const READER_THEMES: ReaderThemeInfo[] = [
  {
    id: "original",
    name: "Original",
    emoji: "📄",
    page: "#FFFFFF",
    background: "#0F172A",
    chrome: "#0F172A",
  },
  {
    id: "sepia",
    name: "Sepia",
    emoji: "📜",
    page: "#F4E7CF",
    background: "#2A2118",
    chrome: "#1F1812",
  },
  {
    id: "night",
    name: "Night",
    emoji: "🌙",
    page: "#1E1E22",
    background: "#050507",
    chrome: "#050507",
  },
  {
    id: "candlelight",
    name: "Candlelight",
    emoji: "🕯️",
    page: "#E9C58E",
    background: "#1A0F06",
    chrome: "#140B04",
  },
];

export function readerThemeInfo(id: ReaderTheme): ReaderThemeInfo {
  return READER_THEMES.find((t) => t.id === id) ?? READER_THEMES[0];
}

export const READER_THEME_IDS = READER_THEMES.map((t) => t.id);
