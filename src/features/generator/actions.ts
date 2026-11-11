"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { databaseError, formValues, validationError, type FieldErrors } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { NO_ASSERTION_MESSAGE, parseStepsText, type TestStep } from "@/lib/test-steps";
import { requireWorkspace } from "@/lib/workspace";
import { pathOf } from "@/lib/page-snapshot";
import { generateTestSuite } from "./claude";
import { capturePage } from "./page-snapshot";
import { takeGenerationLimit } from "./rate-limit";
import {
  GENERATE_FORM_FIELDS,
  MAX_TESTS,
  NEW_SUITE,
  generateInputSchema,
  hasAssertion,
  normalizePath,
  startPageError,
  toGeneratedCases,
  type GeneratedCase,
} from "./schemas";

export type GenerateState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: FieldErrors; values?: Record<string, string> }
  | {
      status: "success";
      projectId: string;
      projectName: string;
      /** Existing suite id, or null when a new suite will be created on save. */
      suiteId: string | null;
      suiteName: string;
      cases: GeneratedCase[];
      /** The page DevPilot opened before generating. */
      page: { url: string; path: string; title: string; finalUrl: string; redirected: boolean };
    };

export type SaveState =
  | { status: "idle" }
  | { status: "error"; message: string; caseErrors?: Record<number, string[]> };

/** Loads a project the caller can see in the active workspace (RLS + workspace filter). */
async function loadProject(projectId: string, workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, base_url")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error("Failed to load project", { cause: error });
  return data;
}

export async function generateTests(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const { workspace } = await requireWorkspace();
  const values = formValues(formData, GENERATE_FORM_FIELDS);
  const parsed = generateInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values) as GenerateState;
  const input = parsed.data;

  const project = await loadProject(input.projectId, workspace.id);
  if (!project) return { status: "error", message: "Project not found.", values };

  // Absolute URLs must stay on the project's site; everything becomes a normalised path.
  const origin = new URL(project.base_url).origin;
  const pathError = (message: string): GenerateState => ({
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: { path: [message] },
    values,
  });
  let path: string | null = input.path;
  if (/^https?:\/\//i.test(path)) {
    let url: URL;
    try {
      url = new URL(path);
    } catch {
      return pathError("Enter a valid URL or a path starting with /");
    }
    if (url.origin !== origin) return pathError(`Use a page on ${origin}`);
    path = pathOf(url);
  }
  path = normalizePath(path);
  if (!path) return pathError("Enter a valid URL or a path starting with /");

  const supabase = await createClient();
  let suiteName = input.newSuiteName;
  let existingTestNames: string[] = [];
  if (input.suiteId !== NEW_SUITE) {
    const { data: suite, error } = await supabase
      .from("test_suites")
      .select("id, name, test_cases(name)")
      .eq("id", input.suiteId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (error) throw new Error("Failed to load suite", { cause: error });
    if (!suite) return { status: "error", message: "Suite not found.", values };
    suiteName = suite.name;
    existingTestNames = suite.test_cases.map((c) => c.name);
  }

  const limit = await takeGenerationLimit();
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60_000));
    return { status: "error", message: `You've reached the generation limit. Try again in ${minutes} min.`, values };
  }

  // Open the exact page first so Claude writes tests against what is really there.
  const capture = await capturePage(project.id, path);
  if (!capture.ok) return { status: "error", message: capture.message, values };
  const { snapshot } = capture;
  if (snapshot.httpStatus !== null && snapshot.httpStatus >= 400) {
    return pathError(`${new URL(path, origin)} responded with HTTP ${snapshot.httpStatus}. Check the page exists.`);
  }

  const result = await generateTestSuite({
    projectName: project.name,
    baseUrl: project.base_url,
    path,
    description: input.description,
    count: input.count,
    existingTestNames,
    snapshot,
  });
  if (!result.ok) return { status: "error", message: result.message, values };

  const cases = toGeneratedCases(result.suite, input.count, path);
  if (cases.length === 0) {
    return { status: "error", message: "Claude didn't return any tests. Try a more specific description.", values };
  }

  return {
    status: "success",
    projectId: project.id,
    projectName: project.name,
    suiteId: input.suiteId === NEW_SUITE ? null : input.suiteId,
    suiteName,
    cases,
    page: {
      url: new URL(path, origin).toString(),
      title: snapshot.title,
      finalUrl: snapshot.finalUrl,
      path,
      redirected: pathOf(new URL(snapshot.finalUrl)) !== path,
    },
  };
}

const saveTargetSchema = z.object({
  projectId: z.uuid(),
  suiteId: z.union([z.uuid(), z.literal("")]),
  suiteName: z.string().trim().min(1).max(100),
  count: z.coerce.number().int().min(1).max(MAX_TESTS),
  path: z.string().max(2048).transform((value, ctx) => {
    const path = normalizePath(value);
    if (!path || !value.startsWith("/")) {
      ctx.addIssue({ code: "custom", message: "Invalid page" });
      return z.NEVER;
    }
    return path;
  }),
});

const caseFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or fewer")
    .transform((v) => (v === "" ? null : v)),
});

/** Picks "Name", "Name (2)", "Name (3)"... avoiding names already taken. */
function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${name.slice(0, 200 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function saveGeneratedTests(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const { workspace } = await requireWorkspace();
  const target = saveTargetSchema.safeParse({
    projectId: formData.get("projectId"),
    suiteId: formData.get("suiteId") ?? "",
    suiteName: formData.get("suiteName"),
    count: formData.get("count"),
    path: formData.get("path"),
  });
  if (!target.success) return { status: "error", message: "Something was off with this form. Generate again." };
  const { projectId, suiteId, suiteName, count, path } = target.data;

  // Re-parse every selected case from the submitted text: client data is never trusted.
  const caseErrors: Record<number, string[]> = {};
  const toInsert: { name: string; description: string | null; steps: TestStep[] }[] = [];
  for (let i = 0; i < count; i++) {
    if (formData.get(`include_${i}`) !== "on") continue;
    const fields = caseFieldsSchema.safeParse({
      name: formData.get(`name_${i}`) ?? "",
      description: formData.get(`description_${i}`) ?? "",
    });
    const steps = parseStepsText(String(formData.get(`steps_${i}`) ?? ""));
    const errors = [
      ...(fields.success ? [] : fields.error.issues.map((issue) => issue.message)),
      ...(steps.ok ? [] : steps.errors),
      ...(steps.ok && !hasAssertion(steps.steps) ? [NO_ASSERTION_MESSAGE] : []),
      ...(steps.ok ? [startPageError(steps.steps, path)].filter((e): e is string => e !== null) : []),
    ];
    if (errors.length || !fields.success || !steps.ok) {
      caseErrors[i] = errors;
      continue;
    }
    toInsert.push({ ...fields.data, steps: steps.steps });
  }

  if (Object.keys(caseErrors).length) {
    return { status: "error", message: "Fix the highlighted tests before saving.", caseErrors };
  }
  if (toInsert.length === 0) return { status: "error", message: "Select at least one test to save." };

  const project = await loadProject(projectId, workspace.id);
  if (!project) return { status: "error", message: "Project not found." };

  const supabase = await createClient();

  // Resolve or create the suite.
  let targetSuiteId = suiteId;
  if (!targetSuiteId) {
    const { data: existing, error: findError } = await supabase
      .from("test_suites")
      .select("id")
      .eq("project_id", project.id)
      .eq("name", suiteName)
      .maybeSingle();
    if (findError) return databaseError(findError) as SaveState;
    if (existing) {
      targetSuiteId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("test_suites")
        .insert({ project_id: project.id, name: suiteName })
        .select("id")
        .single();
      if (error) return databaseError(error) as SaveState;
      targetSuiteId = created.id;
    }
  }

  const { data: taken, error: takenError } = await supabase
    .from("test_cases")
    .select("name")
    .eq("suite_id", targetSuiteId);
  if (takenError) return databaseError(takenError) as SaveState;
  const names = new Set(taken.map((t) => t.name));

  const { error } = await supabase.from("test_cases").insert(
    toInsert.map((c) => {
      const name = uniqueName(c.name, names);
      names.add(name);
      return {
        project_id: project.id,
        suite_id: targetSuiteId,
        name,
        description: c.description,
        steps: c.steps as unknown as Json,
        source: "ai" as const,
      };
    }),
  );
  if (error) return databaseError(error) as SaveState;

  redirect(`/projects/${project.id}`);
}
