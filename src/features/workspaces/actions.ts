"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import { listMyWorkspaces, requireWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { WORKSPACE_FORM_FIELDS, workspaceNameSchema } from "./schemas";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setActiveWorkspace(workspaceId: string) {
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Makes another workspace active. Only workspaces the user belongs to are accepted. */
export async function switchWorkspace(workspaceId: string): Promise<ActionState> {
  await requireUser();
  const workspaces = await listMyWorkspaces();
  if (!workspaces.some((w) => w.id === workspaceId)) return { status: "error", message: "Workspace not found." };
  await setActiveWorkspace(workspaceId);
  // Pages of the previous workspace (e.g. a project) may not exist here.
  redirect("/dashboard");
}

export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const values = formValues(formData, WORKSPACE_FORM_FIELDS);
  const parsed = workspaceNameSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", { p_name: parsed.data.name });
  if (error) return databaseError(error, { values });

  await setActiveWorkspace(data);
  redirect("/dashboard");
}

export async function renameWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, isAdmin } = await requireWorkspace();
  if (!isAdmin) return { status: "error", message: "Only workspace admins can rename the workspace." };

  const values = formValues(formData, WORKSPACE_FORM_FIELDS);
  const parsed = workspaceNameSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", workspace.id)
    .select("id");
  if (error) return databaseError(error, { values });
  if (data.length === 0) return { status: "error", message: "Workspace not found.", values };

  refresh();
  return { status: "success", message: "Workspace renamed." };
}

/** Deletes the active workspace and everything in it. Owners only; the name must be typed to confirm. */
export async function deleteWorkspace(confirmName: string): Promise<ActionState> {
  const { workspace, isOwner } = await requireWorkspace();
  if (!isOwner) return { status: "error", message: "Only workspace owners can delete the workspace." };
  if (confirmName.trim() !== workspace.name) {
    return { status: "error", message: "Type the workspace name exactly to confirm." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("workspaces").delete().eq("id", workspace.id).select("id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Workspace not found." };

  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/dashboard");
}

export async function acceptInvitation(invitationId: string): Promise<ActionState> {
  await requireUser();
  if (!z.uuid().safeParse(invitationId).success) return { status: "error", message: "Invitation not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_invitation_id: invitationId });
  if (error) {
    if (error.code === "P0002") return { status: "error", message: "This invitation no longer exists." };
    return databaseError(error);
  }

  await setActiveWorkspace(data);
  redirect("/dashboard");
}

export async function declineInvitation(invitationId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(invitationId).success || !user.email) {
    return { status: "error", message: "Invitation not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("email", user.email.toLowerCase())
    .select("id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Invitation not found." };

  refresh();
  return { status: "success", message: "Invitation declined." };
}
