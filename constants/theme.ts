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
    primary: palette.accent,
    background: palette.darkBackground,
    card: palette.darkSurface,
    text: palette.textOnDark,
    border: palette.darkBorder,
    notification: palette.accent,
  },
};