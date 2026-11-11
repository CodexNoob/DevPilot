import { describe, expect, it } from "vitest";
import {
  dailyPassRates,
  fillGaps,
  formatDuration,
  passRate,
  passRateTrend,
  sparklinePaths,
  sumDays,
  weightedAverageDuration,
  type DailyStat,
} from "./metrics";

const day = (passed: number, failed: number, avg: number | null = null, extra = 0): DailyStat => ({
  day: "2026-11-01",
  passed,
  failed,
  total: passed + failed + extra,
  avg_duration_ms: avg,
});

describe("passRate", () => {
  it("is null without completed runs and rounds to one decimal", () => {
    expect(passRate(0, 0)).toBeNull();
    expect(passRate(2, 1)).toBe(66.7);
    expect(passRate(352, 445)).toBe(44.2);
  });
});

describe("sumDays", () => {
  it("sums counts, including non-verdict runs in total", () => {
    expect(sumDays([day(1, 1, null, 2), day(3, 0)])).toEqual({ passed: 4, failed: 1, total: 7, passRate: 80 });
    expect(sumDays([])).toEqual({ passed: 0, failed: 0, total: 0, passRate: null });
  });
});

describe("dailyPassRates", () => {
  it("returns null for days with no completed runs", () => {
    expect(dailyPassRates([day(1, 1), day(0, 0, null, 3)])).toEqual([50, null]);
  });
});

describe("passRateTrend", () => {
  it("compares the last window with the previous one", () => {
    const worse = [...Array(7).fill(day(9, 1)), ...Array(7).fill(day(5, 5))];
    const better = [...Array(7).fill(day(5, 5)), ...Array(7).fill(day(9, 1))];
    expect(passRateTrend(worse)).toBe("down");
    expect(passRateTrend(better)).toBe("up");
  });

  it("is flat when a period has no data", () => {
    expect(passRateTrend(Array(7).fill(day(1, 1)))).toBe("flat");
  });
});

describe("weightedAverageDuration", () => {
  it("weights by completed runs and ignores empty days", () => {
    expect(weightedAverageDuration([day(1, 0, 1000), day(3, 0, 3000), day(0, 0, null)])).toBe(2500);
    expect(weightedAverageDuration([day(0, 0)])).toBeNull();
  });

  it("only looks at the last window of days", () => {
    expect(weightedAverageDuration([day(10, 0, 99_000), day(1, 0, 1000)], 1)).toBe(1000);
  });
});

describe("formatDuration", () => {
  it.each([
    [null, "—"],
    [850, "850ms"],
    [42_000, "42s"],
    [66_000, "1.1m"],
    [5_400_000, "1.5h"],
  ])("%s → %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("sparklines", () => {
  it("fills gaps forward, with leading gaps taking the first value", () => {
    expect(fillGaps([null, 2, null, 5, null])).toEqual([2, 2, 2, 5, 5]);
    expect(fillGaps([null, null])).toEqual([]);
  });

  it("builds line and area paths within the viewBox", () => {
    const paths = sparklinePaths([0, 100], 100, 20, [0, 100], 0);
    expect(paths).toEqual({ line: "M0,20 L100,0", area: "M0,20 L100,0 L100,20 L0,20 Z" });
  });

  it("centers a flat series and needs two points", () => {
    expect(sparklinePaths([5, 5], 10, 10, undefined, 0)?.line).toBe("M0,5 L10,5");
    expect(sparklinePaths([5], 10, 10)).toBeNull();
  });
});
