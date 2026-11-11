import "server-only";
import { countRunsBetween } from "@/lib/cron";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import type { DailyStat } from "./metrics";

export const METRICS_WINDOW_DAYS = 30;

export type RecentRun = {
  id: string;
  number: number;
  status: Enums<"test_run_status">;
  trigger: Enums<"test_run_trigger">;
  branch: string;
  createdAt: string;
  passed: number;
  failed: number;
  total: number;
  projectId: string;
  projectName: string;
  clientName: string | null;
  suiteName: string | null;
  triggeredBy: string | null;
};

export type DashboardData = {
  projectCount: number;
  days: DailyStat[];
  runningCount: number;
  queuedCount: number;
  scheduledToday: number;
  recentRuns: RecentRun[];
};

/**
 * Everything the dashboard shows for one workspace. RLS scopes every read to
 * the signed-in user; the explicit workspace filters keep other workspaces
 * the user belongs to out of the numbers.
 */
export async function getDashboardData(workspaceId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const [projects, stats, running, queued, schedules, recent] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.rpc("run_daily_stats", { p_workspace_id: workspaceId, p_days: METRICS_WINDOW_DAYS }),
    supabase
      .from("test_runs")
      .select("id, projects!inner(workspace_id)", { count: "exact", head: true })
      .eq("status", "running")
      .eq("projects.workspace_id", workspaceId),
    supabase
      .from("test_runs")
      .select("id, projects!inner(workspace_id)", { count: "exact", head: true })
      .eq("status", "queued")
      .eq("projects.workspace_id", workspaceId),
    supabase
      .from("schedules")
      .select("cron, timezone, projects!inner(workspace_id)")
      .eq("enabled", true)
      .eq("projects.workspace_id", workspaceId),
    supabase
      .from("test_runs")
      .select(
        `id, number, status, trigger, branch, created_at, passed_count, failed_count, total_count,
         projects!inner(id, name, workspace_id, clients!projects_client_fk(name)),
         test_suites(name),
         profiles!test_runs_triggered_by_fkey(display_name, email)`,
      )
      .eq("projects.workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const failed = [projects, stats, running, queued, schedules, recent].find((r) => r.error);
  if (failed?.error) throw new Error("Failed to load dashboard", { cause: failed.error });

  // Safe after the reads above: request-time data has been accessed.
  const now = new Date();
  const endOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const scheduledToday = (schedules.data ?? []).reduce(
    (sum, s) => sum + countRunsBetween(s.cron, s.timezone, now, endOfDayUtc),
    0,
  );

  return {
    projectCount: projects.count ?? 0,
    days: stats.data ?? [],
    runningCount: running.count ?? 0,
    queuedCount: queued.count ?? 0,
    scheduledToday,
    recentRuns: (recent.data ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      trigger: r.trigger,
      branch: r.branch,
      createdAt: r.created_at,
      passed: r.passed_count,
      failed: r.failed_count,
      total: r.total_count,
      projectId: r.projects.id,
      projectName: r.projects.name,
      clientName: r.projects.clients?.name ?? null,
      suiteName: r.test_suites?.name ?? null,
      triggeredBy: r.profiles?.display_name ?? r.profiles?.email ?? null,
    })),
  };
}
