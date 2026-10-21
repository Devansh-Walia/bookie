import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LockedApp } from "../types";
import {
  clampTier,
  clampTierPages,
  cumulativeThresholds,
  DEFAULT_TIERS,
  MAX_TIERS,
  type Relock,
  relockTier,
} from "../utils/appLock";
import { dateKey } from "../utils/stats";
import useStatsStore from "./statsStore";

interface AppLockState {
  enabled: boolean;
  /** Page increments per tier, e.g. [10, 20, 30]. */
  tiers: number[];
  apps: LockedApp[];
  relock: Relock | null;
  setEnabled: (enabled: boolean) => void;
  setTierPages: (index: number, pages: number) => void;
  addTier: () => void;
  removeTier: (index: number) => void;
  addApps: (apps: Omit<LockedApp, "tier">[]) => void;
  removeApp: (packageName: string) => void;
  setAppTier: (packageName: string, tier: number) => void;
  /** Re-locks `tier` (0-based) and all tiers above it for the rest of today. */
  lockTier: (tier: number) => void;
}

const useAppLockStore = create<AppLockState>()(
  persist(
    (set, get) => ({
      enabled: true,
      tiers: DEFAULT_TIERS,
      apps: [],
      relock: null,
      setEnabled: (enabled) => set({ enabled }),
      setTierPages: (index, pages) =>
        set((s) => ({
          tiers: s.tiers.map((t, i) => (i === index ? clampTierPages(pages) : t)),
        })),
      addTier: () =>
        set((s) =>
          s.tiers.length >= MAX_TIERS
            ? s
            : { tiers: [...s.tiers, s.tiers[s.tiers.length - 1] ?? 10] },
        ),
      removeTier: (index) =>
        set((s) => {
          if (s.tiers.length <= 1) return s;
          const tiers = s.tiers.filter((_, i) => i !== index);
          // Apps above the removed tier shift down one; clamp the rest.
          const apps = s.apps.map((a) => ({
            ...a,
            tier: clampTier(a.tier > index ? a.tier - 1 : a.tier, tiers.length),
          }));
          return { tiers, apps };
        }),
      addApps: (apps) =>
        set((s) => {
          const have = new Set(s.apps.map((a) => a.packageName));
          const added = apps
            .filter((a) => !have.has(a.packageName))
            .map((a) => ({ ...a, tier: 0 }));
          return { apps: [...s.apps, ...added] };
        }),
      removeApp: (packageName) =>
        set((s) => ({
          apps: s.apps.filter((a) => a.packageName !== packageName),
        })),
      setAppTier: (packageName, tier) =>
        set((s) => ({
          apps: s.apps.map((a) =>
            a.packageName === packageName
              ? { ...a, tier: clampTier(tier, s.tiers.length) }
              : a,
          ),
        })),
      lockTier: (tier) => {
        const today = dateKey();
        const pagesToday = useStatsStore.getState().days[today]?.pages ?? 0;
        const next = relockTier(
          tier,
          cumulativeThresholds(get().tiers),
          pagesToday,
          get().relock,
          today,
        );
        if (next) set({ relock: next });
      },
    }),
    {
      name: "app-lock-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

export default useAppLockStore;
