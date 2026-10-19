import type { DayLog } from "../types";

/**
 * Pure, side-effect-free reading statistics helpers. Everything works on
 * local calendar-day keys ("YYYY-MM-DD") so streaks follow the user's clock.
 */

export type DayMap = Record<string, DayLog>;

export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const date = parseKey(key);
  date.setDate(date.getDate() + delta);
  return dateKey(date);
}

/** A day counts towards a streak once you read a page or a full minute. */
export function isActiveDay(log: DayLog | undefined): boolean {
  return !!log && (log.pages > 0 || log.seconds >= 60);
}

export interface StreakInfo {
  current: number;
  best: number;
  readToday: boolean;
}

export function computeStreaks(
  days: DayMap,
  today: string = dateKey(),
): StreakInfo {
  const readToday = isActiveDay(days[today]);

  // The streak stays alive until the end of today, so start counting from
  // yesterday if nothing has been read yet today.
  let cursor = readToday ? today : addDays(today, -1);
  let current = 0;
  while (isActiveDay(days[cursor])) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const activeKeys = Object.keys(days)
    .filter((k) => isActiveDay(days[k]))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of activeKeys) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }

  return { current, best: Math.max(best, current), readToday };
}

export interface DaySummary extends DayLog {
  key: string;
  /** Single-letter weekday label, e.g. "M". */
  label: string;
  isToday: boolean;
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** The last `n` days (oldest first), including today. */
export function lastNDays(
  days: DayMap,
  n: number,
  today: string = dateKey(),
): DaySummary[] {
  const out: DaySummary[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(today, -i);
    const log = days[key];
    out.push({
      key,
      label: WEEKDAY_LETTERS[parseKey(key).getDay()],
      isToday: i === 0,
      pages: log?.pages ?? 0,
      seconds: log?.seconds ?? 0,
    });
  }
  return out;
}

export interface HeatCell {
  key: string;
  pages: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export function heatLevel(pages: number): HeatCell["level"] {
  if (pages <= 0) return 0;
  if (pages < 5) return 1;
  if (pages < 15) return 2;
  if (pages < 30) return 3;
  return 4;
}

/**
 * GitHub-style heatmap: `weeks` columns (oldest first), each with 7 cells
 * from Sunday to Saturday. The last column is the current week.
 */
export function heatmapWeeks(
  days: DayMap,
  weeks: number,
  today: string = dateKey(),
): HeatCell[][] {
  const todayDate = parseKey(today);
  const lastSunday = addDays(today, -todayDate.getDay());
  const start = addDays(lastSunday, -(weeks - 1) * 7);
  const columns: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(start, w * 7 + d);
      const pages = days[key]?.pages ?? 0;
      column.push({ key, pages, level: heatLevel(pages), future: key > today });
    }
    columns.push(column);
  }
  return columns;
}

export interface Totals {
  pages: number;
  seconds: number;
  activeDays: number;
  bestDaySeconds: number;
}

export function totals(days: DayMap): Totals {
  let pages = 0;
  let seconds = 0;
  let activeDays = 0;
  let bestDaySeconds = 0;
  for (const log of Object.values(days)) {
    pages += log.pages;
    seconds += log.seconds;
    if (isActiveDay(log)) activeDays++;
    bestDaySeconds = Math.max(bestDaySeconds, log.seconds);
  }
  return { pages, seconds, activeDays, bestDaySeconds };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? "<1m" : "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeContext {
  totals: Totals;
  streaks: StreakInfo;
  booksFinished: number;
  highlights: number;
  goalDaysHit: number;
  nightOwl: boolean;
  earlyBird: boolean;
}

export interface Badge {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

const BADGES: Array<
  Omit<Badge, "unlocked"> & { test: (c: BadgeContext) => boolean }
> = [
  {
    id: "first-page",
    icon: "📖",
    title: "First Steps",
    description: "Read your first page",
    test: (c) => c.totals.pages >= 1,
  },
  {
    id: "pages-100",
    icon: "🐛",
    title: "Bookworm",
    description: "Read 100 pages",
    test: (c) => c.totals.pages >= 100,
  },
  {
    id: "pages-1000",
    icon: "📚",
    title: "Page Turner",
    description: "Read 1,000 pages",
    test: (c) => c.totals.pages >= 1000,
  },
  {
    id: "finish-1",
    icon: "🏁",
    title: "The End",
    description: "Finish a book",
    test: (c) => c.booksFinished >= 1,
  },
  {
    id: "finish-5",
    icon: "🏆",
    title: "Collector",
    description: "Finish 5 books",
    test: (c) => c.booksFinished >= 5,
  },
  {
    id: "streak-3",
    icon: "🔥",
    title: "On Fire",
    description: "3-day reading streak",
    test: (c) => c.streaks.best >= 3,
  },
  {
    id: "streak-7",
    icon: "⚡",
    title: "Week Warrior",
    description: "7-day reading streak",
    test: (c) => c.streaks.best >= 7,
  },
  {
    id: "streak-30",
    icon: "👑",
    title: "Unstoppable",
    description: "30-day reading streak",
    test: (c) => c.streaks.best >= 30,
  },
  {
    id: "marathon",
    icon: "⏱️",
    title: "Marathon",
    description: "Read for an hour in one day",
    test: (c) => c.totals.bestDaySeconds >= 3600,
  },
  {
    id: "goal-7",
    icon: "🎯",
    title: "Goal Crusher",
    description: "Hit your daily goal 7 times",
    test: (c) => c.goalDaysHit >= 7,
  },
  {
    id: "highlighter",
    icon: "🖍️",
    title: "Highlighter",
    description: "Make 25 highlights",
    test: (c) => c.highlights >= 25,
  },
  {
    id: "night-owl",
    icon: "🦉",
    title: "Night Owl",
    description: "Read after midnight",
    test: (c) => c.nightOwl,
  },
  {
    id: "early-bird",
    icon: "🐦",
    title: "Early Bird",
    description: "Read before 7am",
    test: (c) => c.earlyBird,
  },
];

export function computeBadges(ctx: BadgeContext): Badge[] {
  return BADGES.map(({ test, ...badge }) => ({
    ...badge,
    unlocked: test(ctx),
  }));
}

export function countGoalDays(days: DayMap, goal: number): number {
  if (goal <= 0) return 0;
  return Object.values(days).filter((d) => d.pages >= goal).length;
}

// ---------------------------------------------------------------------------
// Session summary
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  today: DayLog;
  streak: number;
}

export function snapshot(
  days: DayMap,
  today: string = dateKey(),
): ProgressSnapshot {
  return {
    today: {
      pages: days[today]?.pages ?? 0,
      seconds: days[today]?.seconds ?? 0,
    },
    streak: computeStreaks(days, today).current,
  };
}

/** Message shown after a reading session, or null if nothing meaningful happened. */
export function sessionMessage(
  before: ProgressSnapshot,
  after: ProgressSnapshot,
  goal: number,
): { title: string; subtitle: string } | null {
  const pages = after.today.pages - before.today.pages;
  const seconds = after.today.seconds - before.today.seconds;
  if (pages <= 0 && seconds < 60) return null;

  let title = "📖 Nice reading session";
  if (after.streak > before.streak) {
    title =
      after.streak === 1
        ? "🔥 Streak started!"
        : `🔥 ${after.streak}-day streak!`;
  }
  if (before.today.pages < goal && after.today.pages >= goal) {
    title =
      after.streak > before.streak && after.streak > 1
        ? `🎯 Goal reached · 🔥 ${after.streak} days`
        : "🎯 Daily goal reached!";
  }

  const parts = [];
  if (pages > 0) parts.push(`+${pages} ${pages === 1 ? "page" : "pages"}`);
  if (seconds >= 60) parts.push(formatDuration(seconds));
  parts.push(`${after.today.pages}/${goal} today`);
  return { title, subtitle: parts.join(" · ") };
}
