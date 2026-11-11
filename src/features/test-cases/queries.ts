import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type TestCaseSummary = Pick<
  Tables<"test_cases">,
  "id" | "suite_id" | "name" | "description" | "source" | "steps" | "updated_at"
>;

export async function listTestCases(projectId: string): Promise<TestCaseSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_cases")
    .select("id, suite_id, name, description, source, steps, updated_at")
    .eq("project_id", projectId)
    .order("name");

  if (error) throw new Error("Failed to load test cases", { cause: error });
  return data;
}

/** Returns null for malformed ids, missing rows, and rows the user can't see. */
export async function getTestCase(projectId: string, caseId: string): Promise<Tables<"test_cases"> | null> {
  if (!z.uuid().safeParse(projectId).success || !z.uuid().safeParse(caseId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_cases")
    .select("*")
    .eq("id", caseId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error("Failed to load test case", { cause: error });
  return data;
}
