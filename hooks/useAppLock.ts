import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { AppLock, type CheatStats } from "../modules/app-lock";
import useAppLockStore from "../store/appLockStore";
import useStatsStore from "../store/statsStore";
import {
  clampTier,
  cumulativeThresholds,
  effectivePages,
} from "../utils/appLock";
import { dateKey } from "../utils/stats";

function pushConfig() {
  if (!AppLock) return;
  // Pushing before hydration would briefly unlock everything on cold start.
  if (
    !useAppLockStore.persist.hasHydrated() ||
    !useStatsStore.persist.hasHydrated()
  )
    return;
  const { enabled, tiers, apps, relock } = useAppLockStore.getState();
  const today = dateKey();
  const pagesToday = useStatsStore.getState().days[today]?.pages ?? 0;
  try {
    AppLock.setConfig({
      enabled,
      date: today,
      pages: effectivePages(pagesToday, relock, today),
      thresholds: cumulativeThresholds(tiers),
      apps: apps.map((a) => ({
        packageName: a.packageName,
        label: a.label,
        tier: clampTier(a.tier, tiers.length),
      })),
    });
  } catch (e) {
    console.warn("App Lock: failed to sync config", e);
  }
}

/** Keeps the native blocker in sync with the stores. Mount once at the root. */
export function useAppLockSync() {
  useEffect(() => {
    if (!AppLock) return;
    pushConfig();
    const unsubLock = useAppLockStore.subscribe(pushConfig);
    const unsubStats = useStatsStore.subscribe(pushConfig);
    const unsubHydrate = useAppLockStore.persist.onFinishHydration(pushConfig);
    const unsubStatsHydrate =
      useStatsStore.persist.onFinishHydration(pushConfig);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") pushConfig();
    });
    return () => {
      unsubLock();
      unsubStats();
      unsubHydrate();
      unsubStatsHydrate();
      sub.remove();
    };
  }, []);
}

/** Today's tier progress derived from the stores. */
export function useLockProgress() {
  const tiers = useAppLockStore((s) => s.tiers);
  const relock = useAppLockStore((s) => s.relock);
  const today = dateKey();
  const pagesToday = useStatsStore((s) => s.days[today]?.pages ?? 0);
  const thresholds = cumulativeThresholds(tiers);
  const pages = effectivePages(pagesToday, relock, today);
  return { thresholds, pages, pagesToday };
}

/** Native status (permission + cheats), refreshed whenever the app resumes. */
export function useAppLockStatus() {
  const read = useCallback(
    () => ({
      serviceEnabled: AppLock?.isServiceEnabled() ?? false,
      cheats: (AppLock?.getCheatStats() ?? null) as CheatStats | null,
    }),
    [],
  );
  const [status, setStatus] = useState(read);
  const refresh = useCallback(() => setStatus(read()), [read]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { ...status, refresh };
}
