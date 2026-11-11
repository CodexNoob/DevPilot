import { describe, expect, it } from "vitest";
import { branchSchema, formatDuration, parseRunFilters, runsHref } from "./format";

describe("formatDuration", () => {
  it.each([
    [null, "—"],
    [-5, "—"],
    [850, "850ms"],
    [42_000, "42s"],
    [66_000, "1.1m"],
    [90 * 60_000, "1.5h"],
  ])("%s → %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("parseRunFilters", () => {
  it("accepts valid values", () => {
    expect(
      parseRunFilters({ project: "4b1e5a3c-1d2f-4a5b-9c8d-7e6f5a4b3c2d", status: "failed", page: "3" }),
    ).toEqual({ projectId: "4b1e5a3c-1d2f-4a5b-9c8d-7e6f5a4b3c2d", status: "failed", page: 3 });
  });

  it("ignores invalid values", () => {
    expect(parseRunFilters({ project: "x", status: "exploded", page: "-2" })).toEqual({
      projectId: null,
      status: null,
      page: 1,
    });
    expect(parseRunFilters({ status: ["passed", "failed"] }).status).toBe("passed");
  });
});

describe("runsHref", () => {
  it("omits defaults", () => {
    expect(runsHref({})).toBe("/runs");
    expect(runsHref({ status: "running", page: 2 })).toBe("/runs?status=running&page=2");
  });
});

describe("branchSchema", () => {
  it("accepts typical branch names and rejects odd ones", () => {
    expect(branchSchema.safeParse("feature/login-v2").success).toBe(true);
    expect(branchSchema.safeParse("bad branch").success).toBe(false);
    expect(branchSchema.safeParse("").success).toBe(false);
  });
});
