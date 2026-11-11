import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type ClientSummary = Pick<Tables<"clients">, "id" | "name" | "contact_email" | "notes" | "created_at"> & {
  projectCount: number;
};

/** Clients of one workspace with their project counts. */
export async function listClients(workspaceId: string): Promise<ClientSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, contact_email, notes, created_at, projects!projects_client_fk(count)")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) throw new Error("Failed to load clients", { cause: error });
  return data.map(({ projects, ...client }) => ({ ...client, projectCount: projects[0]?.count ?? 0 }));
}

/** Minimal list for select inputs. */
export async function listClientOptions(workspaceId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").eq("workspace_id", workspaceId).order("name");
  if (error) throw new Error("Failed to load clients", { cause: error });
  return data;
}

/** Returns null for malformed ids and clients outside the workspace. */
export async function getClient(workspaceId: string, clientId: string): Promise<Tables<"clients"> | null> {
  if (!z.uuid().safeParse(clientId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error("Failed to load client", { cause: error });
  return data;
}
