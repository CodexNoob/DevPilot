import "server-only";
import { z } from "zod";
import { parsePageErrors, type PageError } from "@/lib/page-errors";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import { RUNS_PAGE_SIZE, type RunFilters } from "./format";

/**
 * Read helpers for test runs. RLS limits rows to workspaces the user belongs
 * to; the explicit workspace filter keeps lists scoped to the active one.
 */

const RUN_LIST_SELECT = `
  id, number, status, trigger, branch, created_at, started_at, finished_at, duration_ms,
  passed_count, failed_count, skipped_count, total_count, project_id,
  projects!inner(name, workspace_id, clients!projects_client_fk(name)),
  test_suites(name),
  profiles!test_runs_triggered_by_fkey(display_name, email)
` as const;

export type RunListItem = {
  id: string;
  number: number;
  status: Enums<"test_run_status">;
  trigger: Enums<"test_run_trigger">;
  branch: string;
  createdAt: string;
  durationMs: number | null;
  passed: number;
  failed: number;
  total: number;
  projectId: string;
  projectName: string;
  clientName: string | null;
  suiteName: string | null;
  triggeredBy: string | null;
};

type RunListRow = {
  id: string;
  number: number;
  status: Enums<"test_run_status">;
  trigger: Enums<"test_run_trigger">;
  branch: string;
  created_at: string;
  duration_ms: number | null;
  passed_count: number;
  failed_count: number;
  total_count: number;
  project_id: string;
  projects: { name: string; clients: { name: string } | null } | null;
  test_suites: { name: string } | null;
  profiles: { display_name: string | null; email: string | null } | null;
};

function toListItem(row: RunListRow): RunListItem {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    trigger: row.trigger,
    branch: row.branch,
    createdAt: row.created_at,
    durationMs: row.duration_ms,
    passed: row.passed_count,
    failed: row.failed_count,
    total: row.total_count,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "Unknown project",
    clientName: row.projects?.clients?.name ?? null,
    suiteName: row.test_suites?.name ?? null,
    triggeredBy:
      row.trigger === "scheduled" ? "Schedule" : (row.profiles?.display_name ?? row.profiles?.email ?? null),
  };
}

export async function listWorkspaceRuns(
  workspaceId: string,
  filters: RunFilters,
): Promise<{ runs: RunListItem[]; total: number }> {
  const supabase = await createClient();
  const from = (filters.page - 1) * RUNS_PAGE_SIZE;

  let query = supabase
    .from("test_runs")
    .select(RUN_LIST_SELECT, { count: "exact" })
    .eq("projects.workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(from, from + RUNS_PAGE_SIZE - 1);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, count, error } = await query;
  if (error) throw new Error("Failed to load test runs", { cause: error });
  return { runs: (data as unknown as RunListRow[]).map(toListItem), total: count ?? 0 };
}

export async function listProjectRuns(projectId: string, limit = 10): Promise<RunListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_runs")
    .select(RUN_LIST_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Failed to load test runs", { cause: error });
  return (data as unknown as RunListRow[]).map(toListItem);
}

export type RunDetail = Tables<"test_runs"> & {
  projectName: string;
  suiteName: string | null;
  triggeredBy: string | null;
};

/** Returns null for malformed ids, missing rows, and runs the user can't see. */
export async function getRun(runId: string): Promise<RunDetail | null> {
  if (!z.uuid().safeParse(runId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_runs")
    .select("*, projects(name), test_suites(name), profiles!test_runs_triggered_by_fkey(display_name, email)")
    .eq("id", runId)
    .maybeSingle();

  if (error) throw new Error("Failed to load test run", { cause: error });
  if (!data) return null;
  const { projects, test_suites, profiles, ...run } = data;
  return {
    ...run,
    projectName: projects?.name ?? "Unknown project",
    suiteName: test_suites?.name ?? null,
    triggeredBy: run.trigger === "scheduled" ? "Schedule" : (profiles?.display_name ?? profiles?.email ?? null),
  };
}

export type RunResult = Tables<"test_results"> & { screenshotUrl: string | null; pageErrors: PageError[] };

/** Results for a run, failures first. Screenshots get short-lived signed URLs. */
export async function listRunResults(runId: string): Promise<RunResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_results")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");

  if (error) throw new Error("Failed to load test results", { cause: error });

  const paths = data.flatMap((r) => (r.screenshot_path ? [r.screenshot_path] : []));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage.from("screenshots").createSignedUrls(paths, 600);
    if (signError) console.error("[runs.screenshots]", signError.message);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  }

  const order: Record<Enums<"test_result_status">, number> = { failed: 0, timed_out: 1, skipped: 2, passed: 3 };
  return data
    .map((r) => ({
      ...r,
      screenshotUrl: r.screenshot_path ? (urls.get(r.screenshot_path) ?? null) : null,
      pageErrors: parsePageErrors(r.page_errors),
    }))
    .sort((a, b) => order[a.status] - order[b.status]);
}

export type RunnableProject = {
  id: string;
  name: string;
  suites: { id: string; name: string; caseCount: number }[];
};

/** Projects in the workspace with their suites and test-case counts, for the "Run tests" dialog. */
export async function listRunnableProjects(workspaceId: string): Promise<RunnableProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, test_suites(id, name, test_cases(count))")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) throw new Error("Failed to load projects", { cause: error });
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    suites: p.test_suites
      .map((s) => ({ id: s.id, name: s.name, caseCount: s.test_cases[0]?.count ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
