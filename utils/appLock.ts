/**
 * Pure rules behind App Lock (no React / native imports, so it's testable).
 *
 * - `tiers` are *increments*: [10, 20, 30] means tier 1 unlocks at 10 pages
 *   read today, tier 2 at 30, tier 3 at 60.
 * - Progress is today's pages minus a "re-lock penalty". Re-locking tier k
 *   drops progress back to where tier k-1 ended, so tier k (and everything
 *   above it) needs to be earned again.
 * - Everything resets at local midnight (callers pass today's date key).
 */

export const DEFAULT_TIERS = [10, 20, 30];
export const MIN_TIER_PAGES = 1;
export const MAX_TIER_PAGES = 500;
export const MAX_TIERS = 10;
/** Cheat passes: how many per day and how long each lasts. Mirrored natively. */
export const PASSES_PER_DAY = 3;
export const PASS_MINUTES = 5;

export interface Relock {
  /** Local date key (YYYY-MM-DD) the penalty applies to. */
  date: string;
  /** Pages subtracted from today's count. */
  penalty: number;
}

/** [10, 20, 30] -> [10, 30, 60] */
export function cumulativeThresholds(tiers: number[]): number[] {
  let sum = 0;
  return tiers.map((t) => (sum += t));
}

export function effectivePages(
  pagesToday: number,
  relock: Relock | null | undefined,
  today: string,
): number {
  const penalty = relock && relock.date === today ? relock.penalty : 0;
  return Math.max(0, pagesToday - penalty);
}

/** How many tiers (from tier 1 upward) are unlocked. */
export function unlockedTierCount(thresholds: number[], pages: number): number {
  let n = 0;
  while (n < thresholds.length && pages >= thresholds[n]) n++;
  return n;
}

/** Clamp an app's tier index to the tiers that currently exist. */
export function clampTier(tier: number, tierCount: number): number {
  if (tierCount <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(tier)), tierCount - 1);
}

/** Pages still to read before the given tier (0-based) unlocks. */
export function pagesNeeded(
  tier: number,
  thresholds: number[],
  pages: number,
): number {
  if (thresholds.length === 0) return 0;
  const t = thresholds[clampTier(tier, thresholds.length)];
  return Math.max(0, t - pages);
}

/**
 * Re-lock `tier` (0-based) and everything above it. Returns the new relock
 * record, or null if the tier isn't currently unlocked (nothing to do).
 */
export function relockTier(
  tier: number,
  thresholds: number[],
  pagesToday: number,
  current: Relock | null | undefined,
  today: string,
): Relock | null {
  const pages = effectivePages(pagesToday, current, today);
  if (tier < 0 || tier >= thresholds.length || pages < thresholds[tier])
    return null;
  const target = tier === 0 ? 0 : thresholds[tier - 1];
  return { date: today, penalty: Math.max(0, pagesToday - target) };
}

export function clampTierPages(pages: number): number {
  return Math.min(MAX_TIER_PAGES, Math.max(MIN_TIER_PAGES, Math.round(pages)));
}
