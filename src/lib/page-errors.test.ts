import { describe, expect, it } from "vitest";
import { countPageErrors, createPageErrorCollector, parsePageErrors } from "./page-errors";

describe("createPageErrorCollector", () => {
  it("groups repeats of the same error and sorts by frequency", () => {
    const c = createPageErrorCollector();
    c.add("http-error", "HTTP 401", "https://luxkitchens.com/api/me", 401);
    c.add("console-error", "connect_error Error: Connection rejected by server");
    c.add("console-error", "connect_error  Error: Connection rejected by server"); // whitespace differs
    c.add("http-error", "HTTP 401", "https://luxkitchens.com/api/other", 401);

    const list = c.list();
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({
      kind: "console-error",
      message: "connect_error Error: Connection rejected by server",
      url: null,
      status: null,
      count: 2,
    });
    expect(countPageErrors(list)).toBe(4);
  });

  it("caps distinct errors and counts what it dropped", () => {
    const c = createPageErrorCollector(2);
    for (let i = 0; i < 5; i++) c.add("page-error", `boom ${i}`);
    c.add("page-error", "boom 0"); // existing entries still count
    expect(c.list()).toHaveLength(2);
    expect(c.dropped).toBe(3);
    expect(countPageErrors(c.list())).toBe(3);
  });

  it("truncates long messages and URLs", () => {
    const c = createPageErrorCollector();
    c.add("request-failed", "x".repeat(2000), `https://example.com/${"a".repeat(2000)}`);
    const [entry] = c.list();
    expect(entry!.message).toHaveLength(500);
    expect(entry!.url).toHaveLength(500);
  });
});

describe("parsePageErrors", () => {
  it("keeps valid entries and drops malformed ones", () => {
    expect(
      parsePageErrors([
        { kind: "page-error", message: "TypeError: x is undefined", url: null, status: null, count: 1 },
        { kind: "made-up", message: "nope" },
        "garbage",
      ]),
    ).toHaveLength(1);
    expect(parsePageErrors(null)).toEqual([]);
  });
});
