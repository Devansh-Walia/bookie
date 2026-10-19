/** Stop counting time if the reader hasn't turned a page for this long. */
export const IDLE_CAP_MS = 5 * 60 * 1000;

export interface SessionSummary {
  pages: number;
  seconds: number;
}

/**
 * Pure accumulator behind `useReadingSession` (exported for tests).
 *
 * - Pages: each *distinct* page visited after the first one counts once.
 * - Time: wall-clock time while active, but never more than IDLE_CAP_MS past
 *   the last page turn, so leaving the book open doesn't inflate stats.
 */
export function createSessionTracker(startMs: number) {
  const visited = new Set<number>();
  let countedFrom: number | null = startMs;
  let lastActivity = startMs;
  let pendingPages = 0;
  let pendingMs = 0;
  const total: SessionSummary = { pages: 0, seconds: 0 };

  function accrue(now: number) {
    if (countedFrom === null) return;
    const end = Math.min(now, lastActivity + IDLE_CAP_MS);
    pendingMs += Math.max(0, end - countedFrom);
    countedFrom = now;
  }

  return {
    page(page: number, now: number) {
      accrue(now);
      lastActivity = now;
      if (!visited.has(page)) {
        if (visited.size > 0) pendingPages++;
        visited.add(page);
      }
    },
    pause(now: number) {
      accrue(now);
      countedFrom = null;
    },
    resume(now: number) {
      countedFrom = now;
      lastActivity = now;
    },
    /** Returns and clears what was accumulated since the last drain. */
    drain(now: number): SessionSummary {
      accrue(now);
      const out = {
        pages: pendingPages,
        seconds: Math.round(pendingMs / 1000),
      };
      // Keep sub-second remainders for the next drain.
      pendingMs -= out.seconds * 1000;
      pendingPages = 0;
      total.pages += out.pages;
      total.seconds += out.seconds;
      return out;
    },
    total(): SessionSummary {
      return { ...total };
    },
  };
}
