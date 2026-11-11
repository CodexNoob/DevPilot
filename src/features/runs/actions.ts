"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import { branchSchema, RUN_FORM_FIELDS } from "./format";

// Users can only *queue* runs (status/trigger/triggered_by default server-side
// and RLS rejects anything else). Execution and results belong to the worker.

const idSchema = z.uuid();

const queueRunSchema = z.object({
  projectId: z.uuid({ error: "Choose a project" }),
  suiteId: z
    .string()
    .transform((value) => (value === "" || value === "all" ? null : value))
    .pipe(z.uuid({ error: "Choose a suite" }).nullable()),
  branch: branchSchema,
});

async function insertRun(projectId: string, suiteId: string | null, branch: string): Promise<ActionState | string> {
  const supabase = await createClient();

  // Fail early with a useful message instead of a run that does nothing.
  let cases = supabase.from("test_cases").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if (suiteId) cases = cases.eq("suite_id", suiteId);
  const { count, error: countError } = await cases;
  if (countError) return databaseError(countError);
  if (!count) {
    return {
      status: "error",
      message: suiteId
        ? "This suite has no test cases yet. Add a test case (or generate some) before running it."
        : "This project has no test cases yet. Add a test case (or generate some) before running tests.",
    };
  }

  const { data, error } = await supabase
    .from("test_runs")
    .insert({ project_id: projectId, suite_id: suiteId, branch })
    .select("id")
    .single();
  if (error) return databaseError(error);
  return data.id;
}

export async function queueRun(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const values = formValues(formData, RUN_FORM_FIELDS);
  const parsed = queueRunSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const result = await insertRun(parsed.data.projectId, parsed.data.suiteId, parsed.data.branch);
  if (typeof result !== "string") return { ...result, ...(result.status === "error" ? { values } : {}) };
  redirect(`/runs/${result}`);
}

/** Queues a new run with the same project, suite and branch. */
export async function rerun(runId: string): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(runId).success) return { status: "error", message: "Run not found." };

  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("test_runs")
    .select("project_id, suite_id, branch")
    .eq("id", runId)
    .maybeSingle();
  if (error) return databaseError(error);
  if (!run) return { status: "error", message: "Run not found." };

  const result = await insertRun(run.project_id, run.suite_id, run.branch);
  if (typeof result !== "string") return result;
  redirect(`/runs/${result}`);
}

export async function cancelRun(runId: string): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(runId).success) return { status: "error", message: "Run not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_run", { p_run_id: runId });
  if (error) return databaseError(error);
  if (!data) return { status: "error", message: "Only queued runs can be cancelled." };
  refresh();
  return { status: "success", message: "Run cancelled." };
}
