import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import useStatsStore from "../store/statsStore";
import { createSessionTracker } from "../utils/sessionTracker";

export type { SessionSummary } from "../utils/sessionTracker";

const FLUSH_INTERVAL_MS = 30 * 1000;

/**
 * Tracks a reading session while `active` and records it into the stats
 * store (periodically, on background, and when the reader closes).
 */
export function useReadingSession(active: boolean) {
  const recordReading = useStatsStore((s) => s.recordReading);
  const trackerRef = useRef<ReturnType<typeof createSessionTracker> | null>(
    null,
  );

  const flush = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const { pages, seconds } = tracker.drain(Date.now());
    if (pages > 0 || seconds > 0) recordReading({ pages, seconds });
  }, [recordReading]);

  useEffect(() => {
    if (!active) return;
    if (!trackerRef.current)
      trackerRef.current = createSessionTracker(Date.now());
    else trackerRef.current.resume(Date.now());

    const sub = AppState.addEventListener("change", (state) => {
      const tracker = trackerRef.current;
      if (!tracker) return;
      if (state === "active") tracker.resume(Date.now());
      else {
        tracker.pause(Date.now());
        flush();
      }
    });
    const interval = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      trackerRef.current?.pause(Date.now());
      flush();
      sub.remove();
      clearInterval(interval);
    };
  }, [active, flush]);

  const onPage = useCallback((page: number) => {
    trackerRef.current?.page(page, Date.now());
  }, []);

  /** Flushes and returns the totals for the whole session so far. */
  const finish = useCallback((): { pages: number; seconds: number } => {
    trackerRef.current?.pause(Date.now());
    flush();
    return trackerRef.current?.total() ?? { pages: 0, seconds: 0 };
  }, [flush]);

  return { onPage, finish };
}
