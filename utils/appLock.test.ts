import {
  clampTier,
  cumulativeThresholds,
  effectivePages,
  pagesNeeded,
  relockTier,
  unlockedTierCount,
} from "./appLock";

const TODAY = "2025-01-02";
const T = cumulativeThresholds([10, 20, 30]); // [10, 30, 60]

describe("cumulativeThresholds", () => {
  it("adds increments", () => {
    expect(T).toEqual([10, 30, 60]);
    expect(cumulativeThresholds([])).toEqual([]);
  });
});

describe("unlockedTierCount / pagesNeeded", () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [29, 1],
    [30, 2],
    [100, 3],
  ])("%d pages -> %d tiers", (pages, n) => {
    expect(unlockedTierCount(T, pages)).toBe(n);
  });

  it("counts remaining pages per tier", () => {
    expect(pagesNeeded(0, T, 4)).toBe(6);
    expect(pagesNeeded(1, T, 12)).toBe(18);
    expect(pagesNeeded(2, T, 70)).toBe(0);
    // Tier index beyond the list clamps to the last tier.
    expect(pagesNeeded(9, T, 0)).toBe(60);
  });
});

describe("effectivePages", () => {
  it("applies today's penalty only", () => {
    expect(effectivePages(40, { date: TODAY, penalty: 10 }, TODAY)).toBe(30);
    expect(effectivePages(40, { date: "2025-01-01", penalty: 10 }, TODAY)).toBe(
      40,
    );
    expect(effectivePages(5, { date: TODAY, penalty: 10 }, TODAY)).toBe(0);
    expect(effectivePages(5, null, TODAY)).toBe(5);
  });
});

describe("relockTier", () => {
  it("drops progress to the start of the re-locked tier", () => {
    // 35 pages read: tiers 1 & 2 unlocked. Re-lock tier 2 -> back to 10.
    const r = relockTier(1, T, 35, null, TODAY)!;
    expect(r).toEqual({ date: TODAY, penalty: 25 });
    const pages = effectivePages(35, r, TODAY);
    expect(pages).toBe(10);
    expect(unlockedTierCount(T, pages)).toBe(1);
    // Needs 20 more pages to unlock tier 2 again.
    expect(pagesNeeded(1, T, pages)).toBe(20);
    expect(unlockedTierCount(T, effectivePages(55, r, TODAY))).toBe(2);
  });

  it("re-locking tier 1 locks everything", () => {
    const r = relockTier(0, T, 70, null, TODAY)!;
    expect(unlockedTierCount(T, effectivePages(70, r, TODAY))).toBe(0);
  });

  it("stacks with an existing penalty", () => {
    const first = relockTier(1, T, 35, null, TODAY)!; // eff 10
    // Read 25 more (60 total, eff 35) -> tier 2 unlocked again; re-lock it.
    const second = relockTier(1, T, 60, first, TODAY)!;
    expect(effectivePages(60, second, TODAY)).toBe(10);
  });

  it("ignores locked or unknown tiers", () => {
    expect(relockTier(1, T, 20, null, TODAY)).toBeNull();
    expect(relockTier(5, T, 100, null, TODAY)).toBeNull();
  });
});

describe("clampTier", () => {
  it("keeps tiers in range", () => {
    expect(clampTier(-1, 3)).toBe(0);
    expect(clampTier(4, 3)).toBe(2);
    expect(clampTier(1, 0)).toBe(0);
  });
});
