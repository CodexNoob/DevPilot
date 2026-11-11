import { describe, expect, it } from "vitest";
import { stepCount, testCaseInputSchema } from "./schemas";

const suiteId = "4b1e5a3c-1d2f-4a5b-9c8d-7e6f5a4b3c2d";

describe("testCaseInputSchema", () => {
  it("parses the step text into steps", () => {
    const parsed = testCaseInputSchema.parse({
      name: " Home loads ",
      description: "",
      suiteId,
      steps: 'goto /\nexpect-visible "h1"',
    });
    expect(parsed).toEqual({
      name: "Home loads",
      description: null,
      suiteId,
      steps: [
        { action: "goto", path: "/" },
        { action: "expect-visible", selector: "h1" },
      ],
    });
  });

  it("rejects tests that check nothing", () => {
    const result = testCaseInputSchema.safeParse({ name: "x", description: "", suiteId, steps: "goto https://luxkitchens.com/" });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.message)).toEqual([expect.stringMatching(/^Add at least one expect-\* step/)]);
  });

  it("reports every step error on the steps field", () => {
    const result = testCaseInputSchema.safeParse({ name: "x", description: "", suiteId, steps: "click\nfly away" });
    expect(result.success).toBe(false);
    const stepIssues = result.error!.issues.filter((i) => i.path[0] === "steps");
    expect(stepIssues).toHaveLength(2);
  });
});

describe("stepCount", () => {
  it("counts arrays and tolerates other values", () => {
    expect(stepCount([{}, {}])).toBe(2);
    expect(stepCount(null)).toBe(0);
  });
});
