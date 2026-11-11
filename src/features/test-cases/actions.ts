"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import { TEST_CASE_FORM_FIELDS, testCaseInputSchema } from "./schemas";

const idSchema = z.uuid();

const CASE_UNIQUE = {
  test_cases_suite_name_unique: { field: "name", message: "This suite already has a test case with this name." },
};

export async function createTestCase(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success) return { status: "error", message: "Project not found." };

  const values = formValues(formData, TEST_CASE_FORM_FIELDS);
  const parsed = testCaseInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { name, description, suiteId, steps } = parsed.data;
  const { error } = await supabase
    .from("test_cases")
    .insert({ project_id: projectId, suite_id: suiteId, name, description, steps, source: "manual" });

  // A suite from another project fails the composite FK (23503).
  if (error?.code === "23503") return { status: "error", message: "Suite not found.", values };
  if (error) return databaseError(error, { uniqueViolations: CASE_UNIQUE, values });
  redirect(`/projects/${projectId}#test-cases`);
}

export async function updateTestCase(
  projectId: string,
  caseId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(caseId).success) {
    return { status: "error", message: "Test case not found." };
  }

  const values = formValues(formData, TEST_CASE_FORM_FIELDS);
  const parsed = testCaseInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { name, description, suiteId, steps } = parsed.data;
  const { data, error } = await supabase
    .from("test_cases")
    .update({ suite_id: suiteId, name, description, steps })
    .eq("id", caseId)
    .eq("project_id", projectId)
    .select("id");

  if (error?.code === "23503") return { status: "error", message: "Suite not found.", values };
  if (error) return databaseError(error, { uniqueViolations: CASE_UNIQUE, values });
  if (data.length === 0) return { status: "error", message: "Test case not found.", values };
  redirect(`/projects/${projectId}#test-cases`);
}

export async function deleteTestCase(projectId: string, caseId: string): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(caseId).success) {
    return { status: "error", message: "Test case not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_cases")
    .delete()
    .eq("id", caseId)
    .eq("project_id", projectId)
    .select("id");

  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Test case not found." };
  refresh();
  return { status: "success", message: "Test case deleted." };
}
