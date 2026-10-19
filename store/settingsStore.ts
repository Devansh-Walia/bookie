import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReaderTheme } from "../types";

interface SettingsState {
  readerTheme: ReaderTheme;
  haptics: boolean;
  setReaderTheme: (theme: ReaderTheme) => void;
  setHaptics: (enabled: boolean) => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      readerTheme: "original",
      haptics: true,
      setReaderTheme: (readerTheme) => set({ readerTheme }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

export default useSettingsStore;
