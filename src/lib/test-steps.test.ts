import { describe, expect, it } from "vitest";
import { formatStepsText, parseStepsText, testStepsSchema } from "./test-steps";
import { countRunsBetween, nextRunAt, validateCron } from "./cron";

describe("parseStepsText", () => {
  it("parses every action, quoted args and comments", () => {
    const result = parseStepsText(`
      # login flow
      goto /login
      fill "#email" "jane@example.com"
      fill "#password" "s3cret \\"quoted\\""
      press "#password" Enter
      click "button[type=submit]"
      wait 250
      expect-visible "text=Welcome back"
      expect-text "h1" "Dashboard"
      expect-url /dashboard
      expect-title "DevPilot"
    `);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(10);
    expect(result.steps[2]).toEqual({ action: "fill", selector: "#password", value: 's3cret "quoted"' });
    expect(result.steps[5]).toEqual({ action: "wait", ms: 250 });
  });

  it("reports line numbers for errors", () => {
    const result = parseStepsText("goto /\nclick\nteleport x\nwait 99999");
    expect(result).toEqual({
      ok: false,
      errors: [
        'Line 2: "click" takes 1 argument(s): selector',
        expect.stringMatching(/^Line 3: unknown action "teleport"/),
        expect.stringMatching(/^Line 4:/),
      ],
    });
  });

  it("rejects relative paths that don't start with /", () => {
    const result = parseStepsText("goto checkout");
    expect(result.ok).toBe(false);
  });

  it("requires at least one step", () => {
    expect(parseStepsText("# nothing").ok).toBe(false);
  });

  it("round-trips through formatStepsText", () => {
    const source = parseStepsText('goto /a\nfill "input[name=q]" "hello world"\nexpect-text "h1" "Say \\"hi\\""');
    if (!source.ok) throw new Error("parse failed");
    const again = parseStepsText(formatStepsText(source.steps));
    expect(again).toEqual(source);
  });

  it("schema rejects unknown actions in JSON (e.g. from AI output)", () => {
    expect(testStepsSchema.safeParse([{ action: "eval", code: "x" }]).success).toBe(false);
  });
});

describe("cron helpers", () => {
  it("validates expressions and frequency", () => {
    expect(validateCron("0 9 * * 1-5")).toEqual({ ok: true });
    expect(validateCron("* * * * *").ok).toBe(false);
    expect(validateCron("0 9 * *").ok).toBe(false);
    expect(validateCron("0 9 * * *", "Mars/Olympus").ok).toBe(false);
  });

  it("computes the next run in a time zone", () => {
    const from = new Date("2026-11-09T00:30:00Z");
    // 09:00 in Manila (UTC+8) is 01:00 UTC.
    expect(nextRunAt("0 9 * * *", "Asia/Manila", from).toISOString()).toBe("2026-11-09T01:00:00.000Z");
  });

  it("counts runs in a window", () => {
    const from = new Date("2026-11-09T00:00:00Z");
    const until = new Date("2026-11-09T23:59:59Z");
    expect(countRunsBetween("0 */6 * * *", "UTC", from, until)).toBe(3);
  });
});
