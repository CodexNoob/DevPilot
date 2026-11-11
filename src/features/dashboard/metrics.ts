/**
 * Pure aggregation helpers for the dashboard. Everything here is
 * deterministic and side-effect free so it can be unit tested.
 */

/** One UTC day as returned by the `run_daily_stats` RPC, oldest first. */
export type DailyStat = {
  day: string;
  passed: number;
  failed: number;
  total: number;
  avg_duration_ms: number | null;
};

/** Percentage 0–100 (one decimal) of verdict runs that passed, or null when none completed. */
export function passRate(passed: number, failed: number): number | null {
  const completed = passed + failed;
  return completed === 0 ? null : Math.round((passed / completed) * 1000) / 10;
}

export type RunTotals = { passed: number; failed: number; total: number; passRate: number | null };

export function sumDays(days: readonly DailyStat[]): RunTotals {
  let passed = 0;
  let failed = 0;
  let total = 0;
  for (const d of days) {
    passed += d.passed;
    failed += d.failed;
    total += d.total;
  }
  return { passed, failed, total, passRate: passRate(passed, failed) };
}

/** Daily pass rate series; days without completed runs are null. */
export function dailyPassRates(days: readonly DailyStat[]): (number | null)[] {
  return days.map((d) => passRate(d.passed, d.failed));
}

export type Trend = "up" | "down" | "flat";

/**
 * Compares the pass rate of the last `window` days with the `window` days
 * before. "flat" when either period has no completed runs or they are equal.
 */
export function passRateTrend(days: readonly DailyStat[], window = 7): Trend {
  const recent = sumDays(days.slice(-window)).passRate;
  const previous = sumDays(days.slice(-2 * window, -window)).passRate;
  if (recent === null || previous === null || recent === previous) return "flat";
  return recent > previous ? "up" : "down";
}

/** Average run duration over the last `window` days, weighted by completed runs per day. */
export function weightedAverageDuration(days: readonly DailyStat[], window = 7): number | null {
  let weighted = 0;
  let weight = 0;
  for (const d of days.slice(-window)) {
    const completed = d.passed + d.failed;
    if (d.avg_duration_ms === null || completed === 0) continue;
    weighted += d.avg_duration_ms * completed;
    weight += completed;
  }
  return weight === 0 ? null : Math.round(weighted / weight);
}

/** "850ms", "42s", "1.1m", "1.5h"; "—" for null. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes * 10) / 10}m`;
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

/**
 * Fills gaps (null) by carrying the previous value forward; leading gaps take
 * the first known value. Returns [] when every value is null.
 */
export function fillGaps(values: readonly (number | null)[]): number[] {
  const first = values.find((v): v is number => v !== null);
  if (first === undefined) return [];
  let last = first;
  return values.map((v) => (v === null ? last : (last = v)));
}

export type SparklinePaths = { line: string; area: string };

/**
 * SVG path data for a sparkline in a `width` × `height` viewBox. `domain`
 * fixes the y range (e.g. [0, 100] for percentages); otherwise it is derived
 * from the data. Nulls are gap-filled. Returns null with fewer than two points.
 */
export function sparklinePaths(
  values: readonly (number | null)[],
  width: number,
  height: number,
  domain?: [number, number],
  padding = 2,
): SparklinePaths | null {
  const points = fillGaps(values);
  if (points.length < 2) return null;

  const min = domain?.[0] ?? Math.min(...points);
  const max = domain?.[1] ?? Math.max(...points);
  const span = max - min;
  const innerHeight = height - padding * 2;
  const step = width / (points.length - 1);

  const coords = points.map((v, i) => {
    const ratio = span === 0 ? 0.5 : (v - min) / span;
    const x = Math.round(i * step * 100) / 100;
    const y = Math.round((padding + innerHeight * (1 - ratio)) * 100) / 100;
    return `${x},${y}`;
  });

  const line = `M${coords.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area };
}
