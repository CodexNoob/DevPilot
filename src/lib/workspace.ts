import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

/** Cookie holding the id of the workspace the user is currently working in. */
export const WORKSPACE_COOKIE = "devpilot_workspace";

export type WorkspaceRole = Enums<"workspace_role">;

export type WorkspaceSummary = { id: string; name: string; role: WorkspaceRole };

export type WorkspaceContext = {
  user: CurrentUser;
  /** The active workspace. */
  workspace: WorkspaceSummary;
  /** Every workspace the user belongs to, for the switcher. */
  workspaces: WorkspaceSummary[];
  isAdmin: boolean;
  isOwner: boolean;
};

/** Workspaces the signed-in user belongs to, oldest first. Deduplicated per request. */
export const listMyWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, created_at, workspaces(id, name)")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) throw new Error("Failed to load workspaces", { cause: error });
  return data.flatMap((m) => (m.workspaces ? [{ id: m.workspaces.id, name: m.workspaces.name, role: m.role }] : []));
});

/**
 * Resolves the active workspace from the cookie, falling back to the user's
 * first workspace. Membership is re-checked on every call (the cookie is only
 * a preference), and RLS enforces it again on every query.
 */
export const requireWorkspace = cache(async (): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const workspaces = await listMyWorkspaces();
  if (workspaces.length === 0) redirect("/workspaces/new");

  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const workspace = workspaces.find((w) => w.id === preferred) ?? workspaces[0]!;
  return {
    user,
    workspace,
    workspaces,
    isAdmin: workspace.role === "owner" || workspace.role === "admin",
    isOwner: workspace.role === "owner",
  };
});

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};
