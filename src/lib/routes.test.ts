import { describe, expect, it } from "vitest";
import { isAuthPath, isProtectedPath, safeRedirectPath } from "./routes";

describe("route classification", () => {
  it("protects app routes but not lookalikes", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/projects/123/edit")).toBe(true);
    expect(isProtectedPath("/projectsfoo")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("identifies auth pages", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/loginx")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/projects/abc", "/projects/abc"],
    ["/projects?tab=runs#x", "/projects?tab=runs#x"],
    ["/a/../dashboard", "/dashboard"],
  ])("keeps same-origin path %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "/\u0000x",
    undefined,
    null,
    42,
  ])("falls back for unsafe value %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/dashboard");
  });
});
