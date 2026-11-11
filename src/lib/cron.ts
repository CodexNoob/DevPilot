import { CronExpressionParser } from "cron-parser";

/**
 * Cron helpers shared by the web app (validating schedules, computing the
 * first run, "Scheduled today") and the worker (computing the next run).
 * Five-field expressions only: minute hour day-of-month month day-of-week.
 */

export type CronCheck = { ok: true } | { ok: false; reason: string };

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateCron(expression: string, timezone = "UTC"): CronCheck {
  const trimmed = expression.trim();
  if (trimmed.split(/\s+/).length !== 5) {
    return { ok: false, reason: "Use 5 fields: minute hour day month weekday (e.g. 0 9 * * 1-5)" };
  }
  if (!isValidTimezone(timezone)) return { ok: false, reason: "Unknown time zone" };
  try {
    const it = CronExpressionParser.parse(trimmed, { tz: timezone });
    // Reject schedules that fire more often than every 5 minutes.
    const first = it.next().getTime();
    const second = it.next().getTime();
    if (second - first < 5 * 60_000) return { ok: false, reason: "Schedules can run at most every 5 minutes" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Invalid cron expression" };
  }
}

/** Next fire time strictly after `from`. */
export function nextRunAt(expression: string, timezone: string, from: Date): Date {
  return CronExpressionParser.parse(expression.trim(), { tz: timezone, currentDate: from }).next().toDate();
}

/** Number of fire times in (from, until]. Capped to keep it cheap. */
export function countRunsBetween(expression: string, timezone: string, from: Date, until: Date, cap = 500): number {
  try {
    const it = CronExpressionParser.parse(expression.trim(), { tz: timezone, currentDate: from, endDate: until });
    let n = 0;
    while (n < cap && it.hasNext()) {
      it.next();
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
