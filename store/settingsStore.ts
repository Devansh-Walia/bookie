import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppThemeMode, ReaderTheme } from "../types";

interface SettingsState {
  /** App-wide light/dark mode for the library chrome. */
  appTheme: AppThemeMode;
  readerTheme: ReaderTheme;
  haptics: boolean;
  setAppTheme: (mode: AppThemeMode) => void;
  setReaderTheme: (theme: ReaderTheme) => void;
  setHaptics: (enabled: boolean) => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appTheme: "system",
      readerTheme: "original",
      haptics: true,
      setAppTheme: (appTheme) => set({ appTheme }),
      setReaderTheme: (readerTheme) => set({ readerTheme }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // New fields are filled from defaults by persist's shallow merge.
      version: 1,
    },
  ),
);

export default useSettingsStore;
