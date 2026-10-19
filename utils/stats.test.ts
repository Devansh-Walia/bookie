import {
  addDays,
  computeBadges,
  computeStreaks,
  countGoalDays,
  dateKey,
  formatDuration,
  heatLevel,
  heatmapWeeks,
  lastNDays,
  sessionMessage,
  snapshot,
  totals,
  DayMap,
} from "./stats";

const TODAY = "2026-03-11"; // a Wednesday

function daysWith(keys: string[], pages = 5): DayMap {
  return Object.fromEntries(keys.map((k) => [k, { pages, seconds: 300 }]));
}

describe("date keys", () => {
  it("formats local dates and does calendar math across month/year boundaries", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("computeStreaks", () => {
  it("counts consecutive days ending today", () => {
    const days = daysWith([TODAY, addDays(TODAY, -1), addDays(TODAY, -2)]);
    expect(computeStreaks(days, TODAY)).toEqual({
      current: 3,
      best: 3,
      readToday: true,
    });
  });

  it("keeps the streak alive until the end of today if yesterday was read", () => {
    const days = daysWith([addDays(TODAY, -1), addDays(TODAY, -2)]);
    expect(computeStreaks(days, TODAY)).toEqual({
      current: 2,
      best: 2,
      readToday: false,
    });
  });

  it("resets after a missed day but remembers the best run", () => {
    const days = daysWith([
      addDays(TODAY, -10),
      addDays(TODAY, -9),
      addDays(TODAY, -8),
      addDays(TODAY, -7),
      addDays(TODAY, -2),
    ]);
    expect(computeStreaks(days, TODAY)).toEqual({
      current: 0,
      best: 4,
      readToday: false,
    });
  });

  it("ignores days with less than a minute and no pages", () => {
    const days: DayMap = { [TODAY]: { pages: 0, seconds: 30 } };
    expect(computeStreaks(days, TODAY).current).toBe(0);
    days[TODAY].seconds = 60;
    expect(computeStreaks(days, TODAY).current).toBe(1);
  });
});

describe("lastNDays / heatmap", () => {
  it("returns the last n days oldest-first with weekday letters", () => {
    const week = lastNDays({ [TODAY]: { pages: 7, seconds: 10 } }, 7, TODAY);
    expect(week).toHaveLength(7);
    expect(week[6]).toMatchObject({
      key: TODAY,
      label: "W",
      isToday: true,
      pages: 7,
    });
    expect(week[0].key).toBe(addDays(TODAY, -6));
  });

  it("builds Sunday-first week columns ending with the current week", () => {
    const grid = heatmapWeeks({ [TODAY]: { pages: 40, seconds: 0 } }, 4, TODAY);
    expect(grid).toHaveLength(4);
    grid.forEach((col) => expect(col).toHaveLength(7));
    const last = grid[3];
    expect(last[0].key).toBe("2026-03-08"); // Sunday
    expect(last[3]).toMatchObject({ key: TODAY, level: 4, future: false });
    expect(last[4].future).toBe(true);
  });

  it("maps pages to heat levels", () => {
    expect([0, 1, 5, 15, 30].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("totals / formatting", () => {
  it("sums days", () => {
    const t = totals({
      a: { pages: 3, seconds: 100 },
      b: { pages: 0, seconds: 4000 },
    });
    expect(t).toEqual({
      pages: 3,
      seconds: 4100,
      activeDays: 2,
      bestDaySeconds: 4000,
    });
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(30)).toBe("<1m");
    expect(formatDuration(125)).toBe("2m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3900)).toBe("1h 5m");
  });

  it("counts days that hit the goal", () => {
    expect(
      countGoalDays(
        { a: { pages: 10, seconds: 0 }, b: { pages: 9, seconds: 0 } },
        10,
      ),
    ).toBe(1);
  });
});

describe("badges", () => {
  it("unlocks badges from the context", () => {
    const badges = computeBadges({
      totals: { pages: 150, seconds: 0, activeDays: 3, bestDaySeconds: 3600 },
      streaks: { current: 3, best: 3, readToday: true },
      booksFinished: 1,
      highlights: 0,
      goalDaysHit: 0,
      nightOwl: true,
      earlyBird: false,
    });
    const unlocked = badges.filter((b) => b.unlocked).map((b) => b.id);
    expect(unlocked).toEqual(
      expect.arrayContaining([
        "first-page",
        "pages-100",
        "finish-1",
        "streak-3",
        "marathon",
        "night-owl",
      ]),
    );
    expect(unlocked).not.toContain("streak-7");
    expect(unlocked).not.toContain("early-bird");
  });
});

describe("sessionMessage", () => {
  const yesterday = addDays(TODAY, -1);

  it("returns null when nothing meaningful happened", () => {
    const before = snapshot({}, TODAY);
    expect(sessionMessage(before, before, 10)).toBeNull();
  });

  it("celebrates extending a streak", () => {
    const base = daysWith([yesterday]);
    const before = snapshot(base, TODAY);
    const after = snapshot(
      { ...base, [TODAY]: { pages: 4, seconds: 400 } },
      TODAY,
    );
    expect(sessionMessage(before, after, 10)).toEqual({
      title: "🔥 2-day streak!",
      subtitle: "+4 pages · 6m · 4/10 today",
    });
  });

  it("celebrates reaching the daily goal", () => {
    const before = snapshot({ [TODAY]: { pages: 8, seconds: 100 } }, TODAY);
    const after = snapshot({ [TODAY]: { pages: 12, seconds: 130 } }, TODAY);
    expect(sessionMessage(before, after, 10)?.title).toBe(
      "🎯 Daily goal reached!",
    );
  });
});
