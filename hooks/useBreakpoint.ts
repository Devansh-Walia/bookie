import { useWindowDimensions } from "react-native";

/** Width at which the app switches from the phone layout to the desktop one. */
export const DESKTOP_MIN_WIDTH = 900;

/** Widest the content column gets, so it doesn't stretch on huge monitors. */
export const CONTENT_MAX_WIDTH = 1280;

export interface Breakpoint {
  width: number;
  isDesktop: boolean;
  /** Library grid columns for the current width. */
  columns: number;
}

/** Library grid columns for a given viewport width. */
export function columnsForWidth(width: number): number {
  if (width >= 1500) return 6;
  if (width >= 1200) return 5;
  if (width >= 900) return 4;
  return 3;
}

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return {
    width,
    isDesktop: width >= DESKTOP_MIN_WIDTH,
    columns: columnsForWidth(width),
  };
}
