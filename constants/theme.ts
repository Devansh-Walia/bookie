import { DarkTheme, DefaultTheme } from "@react-navigation/native";

/**
 * Bookie design system — a single source of truth for the app's palette,
 * spacing and radii so the library and reader feel cohesive and modern.
 */

export const palette = {
  // Brand
  primary: "#6366F1", // indigo
  primaryDark: "#4F46E5",
  accent: "#8B5CF6", // violet
  accentSoft: "#EDE9FE",

  // Light surfaces
  lightBackground: "#F7F8FC",
  lightCard: "#FFFFFF",
  lightBorder: "#E8EAF0",

  // Dark surfaces (reader)
  darkBackground: "#0F172A",
  darkSurface: "#1E293B",
  darkSurfaceAlt: "#16202F",
  darkBorder: "#2A3548",

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textOnDark: "#F1F5F9",
  textOnDarkMuted: "#94A3B8",

  // Semantic
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Semantic colors for the app chrome (library, stats, settings). Components
 * read these via `useAppColors()` so they follow the light/dark setting. The
 * reader keeps its own palette (see `readerThemes.ts`).
 */
export interface AppColors {
  scheme: "light" | "dark";
  primary: string;
  accentSoft: string;
  background: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** High-contrast fill (active chips, toasts) and the text drawn on it. */
  inverse: string;
  onInverse: string;
  onInverseMuted: string;
  track: string;
  coverPlaceholder: string;
  backdrop: string;
  danger: string;
  success: string;
  warning: string;
  streakBg: string;
  streakBorder: string;
  streakText: string;
  streakTextStrong: string;
  streakPill: string;
  streakRiskBg: string;
  streakRiskBorder: string;
  heat: [string, string, string, string, string];
}

export const lightColors: AppColors = {
  scheme: "light",
  primary: palette.primary,
  accentSoft: palette.accentSoft,
  background: palette.lightBackground,
  card: palette.lightCard,
  border: palette.lightBorder,
  text: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textMuted: "#94A3B8",
  inverse: palette.textPrimary,
  onInverse: "#FFFFFF",
  onInverseMuted: palette.textOnDarkMuted,
  track: "#E2E8F0",
  coverPlaceholder: "#E2E8F0",
  backdrop: "rgba(15,23,42,0.45)",
  danger: palette.danger,
  success: palette.success,
  warning: palette.warning,
  streakBg: "#FFF7ED",
  streakBorder: "#FED7AA",
  streakText: "#C2410C",
  streakTextStrong: "#9A3412",
  streakPill: "#FFFFFF",
  streakRiskBg: "#FEF2F2",
  streakRiskBorder: "#FECACA",
  heat: ["#E8EAF0", "#C7D2FE", "#A5B4FC", "#818CF8", "#4F46E5"],
};

export const darkColors: AppColors = {
  scheme: "dark",
  primary: palette.primary,
  accentSoft: "#2A2752",
  background: "#0B1120",
  card: "#151E2E",
  border: "#243047",
  text: palette.textOnDark,
  textSecondary: palette.textOnDarkMuted,
  textMuted: "#64748B",
  inverse: palette.textOnDark,
  onInverse: palette.textPrimary,
  onInverseMuted: palette.textSecondary,
  track: "#243047",
  coverPlaceholder: "#1E293B",
  backdrop: "rgba(0,0,0,0.6)",
  danger: "#F87171",
  success: "#34D399",
  warning: palette.warning,
  streakBg: "#2A1A0E",
  streakBorder: "#7C2D12",
  streakText: "#FB923C",
  streakTextStrong: "#FDBA74",
  streakPill: "#1C1209",
  streakRiskBg: "#2D1215",
  streakRiskBorder: "#7F1D1D",
  heat: ["#1E293B", "#312E81", "#4338CA", "#6366F1", "#A5B4FC"],
};

export const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primary,
    background: palette.lightBackground,
    card: palette.lightCard,
    text: palette.textPrimary,
    border: palette.lightBorder,
    notification: palette.primary,
  },
};

export const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.primary,
    background: darkColors.background,
    card: darkColors.card,
    text: darkColors.text,
    border: darkColors.border,
    notification: palette.primary,
  },
};
