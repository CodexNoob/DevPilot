import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FlakyTest = {
  projectId: string;
  projectName: string;
  testName: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  failureRate: number;
  lastRunAt: string;
  lastFailedAt: string | null;
};

/**
 * Tests that both passed and failed in the last 30 days, in the active
 * workspace. The view is security_invoker, so RLS applies as usual.
 */
export async function listFlakyTests(workspaceId: string): Promise<FlakyTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flaky_tests")
    .select("*, projects!inner(name, workspace_id)")
    .eq("projects.workspace_id", workspaceId)
    .order("failure_rate", { ascending: false })
    .order("total_runs", { ascending: false })
    .limit(200);

  if (error) throw new Error("Failed to load flaky tests", { cause: error });
  return data.map((row) => ({
    projectId: row.project_id,
    projectName: row.projects.name,
    testName: row.test_name,
    totalRuns: row.total_runs,
    passedRuns: row.passed_runs,
    failedRuns: row.failed_runs,
    // numeric comes back as a string from PostgREST in some setups.
    failureRate: Number(row.failure_rate),
    lastRunAt: row.last_run_at,
    lastFailedAt: row.last_failed_at,
  }));
}
