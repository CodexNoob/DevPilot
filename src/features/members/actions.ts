"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import { requireWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { canChangeRole, canRemoveMember } from "@/features/workspaces/permissions";
import { INVITE_FORM_FIELDS, inviteInputSchema, roleSchema } from "./schemas";

// Permission checks here mirror RLS so users get clear messages; the
// database is still the authority and rejects anything these miss.

const LAST_OWNER: ActionState = {
  status: "error",
  message: "A workspace must have at least one owner. Make someone else an owner first.",
};

type DbError = { code?: string; message: string; hint?: string | null };
const isLastOwnerError = (error: DbError) => error.code === "P0001" && /at least one owner/i.test(error.message);

async function memberRole(workspaceId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, isAdmin, user } = await requireWorkspace();
  if (!isAdmin) return { status: "error", message: "Only workspace admins can invite people." };

  const values = formValues(formData, INVITE_FORM_FIELDS);
  const parsed = inviteInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  if (parsed.data.email === user.email?.toLowerCase()) {
    return { status: "error", message: "You're already a member.", fieldErrors: { email: ["That's you."] }, values };
  }

  const supabase = await createClient();
  const { data: existingMembers, error: memberLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .limit(1);
  if (memberLookupError) return databaseError(memberLookupError, { values });
  if (existingMembers[0]) {
    const { data: memberships, error: membershipLookupError } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", existingMembers[0].id)
      .limit(1);
    if (membershipLookupError) return databaseError(membershipLookupError, { values });
    if (memberships.length > 0) {
      return { status: "error", message: "This person is already a workspace member.", fieldErrors: { email: ["Already a member."] }, values };
    }
  }

  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: workspace.id,
    email: parsed.data.email,
    role: parsed.data.role,
    invited_by: user.id,
  });

  if (error) {
    return databaseError(error, {
      values,
      uniqueViolations: {
        workspace_invitations_workspace_email_unique: {
          field: "email",
          message: "This email already has a pending invitation.",
        },
      },
    });
  }
  refresh();
  return { status: "success", message: `Invitation created for ${parsed.data.email}. Share the invite instructions below.` };
}

export async function revokeInvitation(invitationId: string): Promise<ActionState> {
  const { workspace, isAdmin } = await requireWorkspace();
  if (!isAdmin) return { status: "error", message: "Only workspace admins can revoke invitations." };
  if (!z.uuid().safeParse(invitationId).success) return { status: "error", message: "Invitation not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("workspace_id", workspace.id)
    .select("id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Invitation not found." };
  refresh();
  return { status: "success", message: "Invitation revoked." };
}

export async function changeMemberRole(userId: string, nextRole: string): Promise<ActionState> {
  const { workspace } = await requireWorkspace();
  const role = roleSchema.safeParse(nextRole);
  if (!z.uuid().safeParse(userId).success || !role.success) return { status: "error", message: "Member not found." };

  const target = await memberRole(workspace.id, userId);
  if (!target) return { status: "error", message: "Member not found." };
  if (!canChangeRole(workspace.role, target, role.data)) {
    return { status: "error", message: "You don't have permission to make that change." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role: role.data })
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return isLastOwnerError(error) ? LAST_OWNER : databaseError(error);
  if (data.length === 0) return { status: "error", message: "You don't have permission to make that change." };

  refresh();
  return { status: "success", message: "Role updated." };
}

export async function removeMember(userId: string): Promise<ActionState> {
  const { workspace, user } = await requireWorkspace();
  if (!z.uuid().safeParse(userId).success) return { status: "error", message: "Member not found." };
  const isSelf = userId === user.id;

  const target = await memberRole(workspace.id, userId);
  if (!target) return { status: "error", message: "Member not found." };
  if (!canRemoveMember(workspace.role, target, isSelf)) {
    return { status: "error", message: "You don't have permission to remove this member." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return isLastOwnerError(error) ? LAST_OWNER : databaseError(error);
  if (data.length === 0) return { status: "error", message: "You don't have permission to remove this member." };

  if (isSelf) {
    // Left the workspace: fall back to another one.
    (await cookies()).delete(WORKSPACE_COOKIE);
    redirect("/dashboard");
  }
  refresh();
  return { status: "success", message: "Member removed." };
}
