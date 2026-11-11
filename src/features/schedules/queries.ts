import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type ScheduleSummary = Tables<"schedules"> & { suiteName: string | null };

export async function listSchedules(projectId: string): Promise<ScheduleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("*, test_suites(name)")
    .eq("project_id", projectId)
    .order("name");

  if (error) throw new Error("Failed to load schedules", { cause: error });
  return data.map(({ test_suites, ...schedule }) => ({ ...schedule, suiteName: test_suites?.name ?? null }));
}
