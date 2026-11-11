"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import { CLIENT_FORM_FIELDS, clientInputSchema, type ClientInput } from "./schemas";

// Clients are managed by workspace admins. RLS enforces it; the checks here
// only give a clear message instead of a silent "0 rows".

const CLIENT_UNIQUE = {
  clients_workspace_name_unique: { field: "name", message: "This workspace already has a client with this name." },
};
const ADMIN_ONLY: ActionState = { status: "error", message: "Only workspace admins can manage clients." };
const NOT_FOUND: ActionState = { status: "error", message: "Client not found." };

const toRow = (input: ClientInput) => ({ name: input.name, contact_email: input.contactEmail, notes: input.notes });

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, isAdmin } = await requireWorkspace();
  if (!isAdmin) return ADMIN_ONLY;

  const values = formValues(formData, CLIENT_FORM_FIELDS);
  const parsed = clientInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({ ...toRow(parsed.data), workspace_id: workspace.id });
  if (error) return databaseError(error, { uniqueViolations: CLIENT_UNIQUE, values });

  refresh();
  return { status: "success", message: `Client "${parsed.data.name}" added.` };
}

export async function updateClientAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace, isAdmin } = await requireWorkspace();
  if (!isAdmin) return ADMIN_ONLY;
  if (!z.uuid().safeParse(clientId).success) return NOT_FOUND;

  const values = formValues(formData, CLIENT_FORM_FIELDS);
  const parsed = clientInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update(toRow(parsed.data))
    .eq("id", clientId)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return databaseError(error, { uniqueViolations: CLIENT_UNIQUE, values });
  if (data.length === 0) return { status: "error", message: "Client not found.", values };
  redirect(`/clients/${clientId}`);
}

export async function deleteClientAction(clientId: string): Promise<ActionState> {
  const { workspace, isAdmin } = await requireWorkspace();
  if (!isAdmin) return ADMIN_ONLY;
  if (!z.uuid().safeParse(clientId).success) return NOT_FOUND;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return databaseError(error);
  if (data.length === 0) return NOT_FOUND;
  redirect("/clients");
}
