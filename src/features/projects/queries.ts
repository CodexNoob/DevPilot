import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { idSchema } from "./schemas";

/**
 * Read helpers for the projects module. All queries run as the signed-in
 * user, so RLS restricts results to their own data. Thrown errors surface
 * in the nearest error.tsx boundary.
 */

export type ProjectSummary = Pick<
  Tables<"projects">,
  "id" | "name" | "description" | "base_url" | "environment" | "updated_at" | "client_id"
> & { suiteCount: number; client: { id: string; name: string } | null };

/**
 * Projects in the given workspace (RLS would also return other workspaces the
 * user belongs to), optionally only those of one client.
 */
export async function listProjects(workspaceId: string, clientId?: string): Promise<ProjectSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select(
      "id, name, description, base_url, environment, updated_at, client_id, test_suites(count), clients!projects_client_fk(id, name)",
    )
    .eq("workspace_id", workspaceId);
  if (clientId && idSchema.safeParse(clientId).success) query = query.eq("client_id", clientId);

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error("Failed to load projects", { cause: error });

  return data.map(({ test_suites, clients, ...project }) => ({
    ...project,
    suiteCount: test_suites[0]?.count ?? 0,
    client: clients ?? null,
  }));
}

/** Returns null for malformed ids, missing rows, and rows the user can't see. */
export async function getProject(projectId: string): Promise<Tables<"projects"> | null> {
  if (!idSchema.safeParse(projectId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();

  if (error) throw new Error("Failed to load project", { cause: error });
  return data;
}

export async function listSuites(projectId: string): Promise<Tables<"test_suites">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_suites")
    .select("*")
    .eq("project_id", projectId)
    .order("name");

  if (error) throw new Error("Failed to load test suites", { cause: error });
  return data;
}

export type RunSummary = Pick<Tables<"test_runs">, "id" | "status" | "trigger" | "created_at" | "started_at" | "finished_at"> & {
  suiteName: string | null;
};

export async function listRecentRuns(projectId: string, limit = 10): Promise<RunSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_runs")
    .select("id, status, trigger, created_at, started_at, finished_at, test_suites(name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Failed to load test runs", { cause: error });
  return data.map(({ test_suites, ...run }) => ({ ...run, suiteName: test_suites?.name ?? null }));
}
