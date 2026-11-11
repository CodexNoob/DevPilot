"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listMyWorkspaces, requireWorkspace } from "@/lib/workspace";
import { isAdminRole } from "@/features/workspaces/permissions";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import {
  PROJECT_FORM_FIELDS,
  SUITE_FORM_FIELDS,
  idSchema,
  projectInputSchema,
  suiteInputSchema,
} from "./schemas";

// Every action re-authenticates and re-validates on the server: actions are
// public HTTP endpoints, and the client can send anything. RLS is the final
// authority on what rows a user may touch.

const PROJECT_UNIQUE = {
  projects_workspace_name_unique: { field: "name", message: "This workspace already has a project with this name." },
};
const SUITE_UNIQUE = {
  test_suites_project_name_unique: { field: "name", message: "This project already has a suite with this name." },
};

function toProjectRow(input: ReturnType<typeof projectInputSchema.parse>) {
  return {
    name: input.name,
    description: input.description,
    base_url: input.baseUrl,
    environment: input.environment,
    client_id: input.clientId,
  };
}

/** The composite FK rejects clients from another workspace (or deleted ones). */
function projectWriteError(error: { code?: string; message: string }, values: Record<string, string>): ActionState {
  if (error.code === "23503" && error.message.includes("projects_client_fk")) {
    const message = "That client no longer exists in this workspace.";
    return { status: "error", message, fieldErrors: { clientId: [message] }, values };
  }
  return databaseError(error, { uniqueViolations: PROJECT_UNIQUE, values });
}

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await requireWorkspace();
  const values = formValues(formData, PROJECT_FORM_FIELDS);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...toProjectRow(parsed.data), workspace_id: workspace.id })
    .select("id")
    .single();

  if (error) return projectWriteError(error, values);
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success) return { status: "error", message: "Project not found." };

  const values = formValues(formData, PROJECT_FORM_FIELDS);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(toProjectRow(parsed.data))
    .eq("id", projectId)
    .select("id");

  if (error) return projectWriteError(error, values);
  // RLS turns unauthorised updates into "0 rows affected", not an error.
  if (data.length === 0) return { status: "error", message: "Project not found.", values };
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success) return { status: "error", message: "Project not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id");

  if (error) return databaseError(error);
  if (data.length === 0) {
    // Deleting needs admin rights. If the project is visible, that's why it failed.
    const { data: visible } = await supabase.from("projects").select("workspace_id").eq("id", projectId).maybeSingle();
    if (visible) {
      const role = (await listMyWorkspaces()).find((w) => w.id === visible.workspace_id)?.role;
      if (!isAdminRole(role)) return { status: "error", message: "Only workspace admins can delete projects." };
    }
    return { status: "error", message: "Project not found." };
  }
  redirect("/projects");
}

export async function createSuite(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success) return { status: "error", message: "Project not found." };

  const values = formValues(formData, SUITE_FORM_FIELDS);
  const parsed = suiteInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("test_suites").insert({ project_id: projectId, ...parsed.data });

  if (error) return databaseError(error, { uniqueViolations: SUITE_UNIQUE, values });
  refresh();
  return { status: "success", message: `Suite "${parsed.data.name}" created.` };
}

export async function deleteSuite(projectId: string, suiteId: string): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(suiteId).success) {
    return { status: "error", message: "Suite not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_suites")
    .delete()
    .eq("id", suiteId)
    .eq("project_id", projectId)
    .select("id");

  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Suite not found." };
  refresh();
  return { status: "success", message: "Suite deleted." };
}
