import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type Member = {
  userId: string;
  role: Enums<"workspace_role">;
  joinedAt: string;
  displayName: string | null;
  email: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: Enums<"workspace_role">;
  createdAt: string;
};

const ROLE_ORDER: Record<Enums<"workspace_role">, number> = { owner: 0, admin: 1, member: 2 };

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at, profiles(display_name, email)")
    .eq("workspace_id", workspaceId)
    .order("created_at");

  if (error) throw new Error("Failed to load members", { cause: error });
  return data
    .map((m) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: m.created_at,
      displayName: m.profiles?.display_name ?? null,
      email: m.profiles?.email ?? null,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

/** Pending invitations of a workspace. RLS returns rows only to admins. */
export async function listInvitations(workspaceId: string): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("id, email, role, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to load invitations", { cause: error });
  return data.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at }));
}
