import { describe, expect, it } from "vitest";
import { assignableRoles, canChangeRole, canRemoveMember, isAdminRole, normalizeEmail } from "./permissions";

describe("workspace permissions", () => {
  it("identifies admin roles", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("member")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it("members can't change roles", () => {
    expect(canChangeRole("member", "member", "admin")).toBe(false);
  });

  it("admins manage members and admins but not owners", () => {
    expect(canChangeRole("admin", "member", "admin")).toBe(true);
    expect(canChangeRole("admin", "admin", "member")).toBe(true);
    expect(canChangeRole("admin", "member", "owner")).toBe(false);
    expect(canChangeRole("admin", "owner", "member")).toBe(false);
  });

  it("owners can do everything except no-op changes", () => {
    expect(canChangeRole("owner", "member", "owner")).toBe(true);
    expect(canChangeRole("owner", "owner", "admin")).toBe(true);
    expect(canChangeRole("owner", "admin", "admin")).toBe(false);
  });

  it("lists assignable roles including the current one", () => {
    expect(assignableRoles("admin", "member")).toEqual(["admin", "member"]);
    expect(assignableRoles("owner", "member")).toEqual(["owner", "admin", "member"]);
    expect(assignableRoles("member", "member")).toEqual(["member"]);
  });

  it("removal rules mirror RLS", () => {
    expect(canRemoveMember("member", "member", true)).toBe(true);
    expect(canRemoveMember("member", "member", false)).toBe(false);
    expect(canRemoveMember("admin", "member", false)).toBe(true);
    expect(canRemoveMember("admin", "owner", false)).toBe(false);
    expect(canRemoveMember("owner", "owner", false)).toBe(true);
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
  });

  it("rejects non-emails", () => {
    expect(normalizeEmail("jane")).toBeNull();
    expect(normalizeEmail("jane@localhost")).toBeNull();
    expect(normalizeEmail("a b@example.com")).toBeNull();
  });
});
