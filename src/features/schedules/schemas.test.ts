import { describe, expect, it } from "vitest";
import { scheduleInputSchema } from "./schemas";

const base = { name: "Nightly", cron: "0 2 * * *", timezone: "Asia/Manila", branch: "main", suiteId: "all", enabled: "on" };

describe("scheduleInputSchema", () => {
  it("accepts a valid schedule", () => {
    expect(scheduleInputSchema.parse(base)).toEqual({ ...base, suiteId: null, enabled: true });
  });

  it("treats a missing checkbox as disabled", () => {
    expect(scheduleInputSchema.parse({ ...base, enabled: "" }).enabled).toBe(false);
  });

  it("puts cron and time zone errors on the right field", () => {
    const badCron = scheduleInputSchema.safeParse({ ...base, cron: "* * * * *" });
    expect(badCron.error?.issues[0]?.path).toEqual(["cron"]);
    const badTz = scheduleInputSchema.safeParse({ ...base, timezone: "Nowhere/City" });
    expect(badTz.error?.issues[0]?.path).toEqual(["timezone"]);
  });
});
