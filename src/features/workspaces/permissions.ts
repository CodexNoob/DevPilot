import type { Enums } from "@/lib/supabase/database.types";

type Role = Enums<"workspace_role">;

/**
 * Pure mirrors of the workspace RLS rules, used to decide which controls to
 * show. The database remains the authority: these only keep the UI honest.
 */

export const isAdminRole = (role: Role | null | undefined): boolean => role === "owner" || role === "admin";

/** Roles an inviter may hand out. Ownership is never given by invitation. */
export const INVITABLE_ROLES = ["member", "admin"] as const satisfies readonly Role[];

/** Can `actor` change a member whose role is `target` to `next`? */
export function canChangeRole(actor: Role, target: Role, next: Role): boolean {
  if (target === next) return false;
  if (!isAdminRole(actor)) return false;
  // Only owners may touch owners or create new owners.
  if ((target === "owner" || next === "owner") && actor !== "owner") return false;
  return true;
}

/** Roles `actor` could assign to a member currently holding `target`. */
export function assignableRoles(actor: Role, target: Role): Role[] {
  return (["owner", "admin", "member"] as const).filter((next) => next === target || canChangeRole(actor, target, next));
}

/** Can `actor` remove a member with role `target`? Everyone can remove themselves (leave). */
export function canRemoveMember(actor: Role, target: Role, isSelf: boolean): boolean {
  if (isSelf) return true;
  if (!isAdminRole(actor)) return false;
  return target !== "owner" || actor === "owner";
}

/** Lower-cases and trims an email; returns null when it isn't plausibly an email. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
