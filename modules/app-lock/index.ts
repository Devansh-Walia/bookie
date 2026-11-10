import { requireOptionalNativeModule } from "expo";

export interface InstalledApp {
  packageName: string;
  label: string;
  /** PNG data URI, or null if the icon couldn't be rendered. */
  icon: string | null;
}

export interface CheatStats {
  today: number;
  total: number;
  passesLeft: number;
  /** Passes used per day, keyed "YYYY-MM-DD". */
  history: Record<string, number>;
}

/** What the native side needs to decide whether to block an app. */
export interface AppLockConfig {
  enabled: boolean;
  /** Local date the `pages` value belongs to; native treats other days as 0. */
  date: string;
  /** Today's pages after any re-lock penalty. */
  pages: number;
  /** Cumulative pages per tier, e.g. [10, 30, 60]. */
  thresholds: number[];
  apps: { packageName: string; label: string; tier: number }[];
}

/** Special-access grants App Lock needs; both must be true. */
export interface AppLockPermissions {
  /** Settings → Usage access: lets Bookie see which app is in front. */
  usageAccess: boolean;
  /** Display over other apps: lets Bookie cover a locked app. */
  overlay: boolean;
}

interface AppLockNative {
  getInstalledApps(): Promise<InstalledApp[]>;
  getPermissions(): AppLockPermissions;
  openUsageAccessSettings(): void;
  openOverlaySettings(): void;
  openAppSettings(): void;
  setConfig(json: string): void;
  getCheatStats(): CheatStats;
}

const native = requireOptionalNativeModule<AppLockNative>("AppLock");

/** Null on iOS / web / Expo Go, where App Lock isn't available. */
export const AppLock = native
  ? {
      getInstalledApps: () => native.getInstalledApps(),
      getPermissions: () => native.getPermissions(),
      openUsageAccessSettings: () => native.openUsageAccessSettings(),
      openOverlaySettings: () => native.openOverlaySettings(),
      openAppSettings: () => native.openAppSettings(),
      setConfig: (config: AppLockConfig) =>
        native.setConfig(JSON.stringify(config)),
      getCheatStats: () => native.getCheatStats(),
    }
  : null;
