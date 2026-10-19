import { useEffect, useMemo } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { AppColors, darkColors, lightColors } from "../constants/theme";
import useSettingsStore from "../store/settingsStore";

/**
 * Applies the user's appearance choice to the native layer so system UI
 * (alerts, keyboards, date pickers) matches. Call once from the root layout.
 */
export function useApplyAppearance() {
  const mode = useSettingsStore((s) => s.appTheme);
  useEffect(() => {
    if (Platform.OS === "web") return;
    Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
  }, [mode]);
}

/** Resolved color scheme for the app chrome. */
export function useAppScheme(): "light" | "dark" {
  const mode = useSettingsStore((s) => s.appTheme);
  const system = useColorScheme();
  if (mode === "system") return system === "dark" ? "dark" : "light";
  return mode;
}

export function useAppColors(): AppColors {
  return useAppScheme() === "dark" ? darkColors : lightColors;
}

/**
 * Memoized themed styles. Define `const makeStyles = (c: AppColors) =>
 * StyleSheet.create({...})` at module level and call
 * `const styles = useThemedStyles(makeStyles)` in the component.
 */
export function useThemedStyles<T>(factory: (c: AppColors) => T): T {
  const colors = useAppColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
