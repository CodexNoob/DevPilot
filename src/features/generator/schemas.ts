import { z } from "zod";
import { formatStepsText, testStepsSchema, type TestStep } from "@/lib/test-steps";

export const MAX_TESTS = 10;
export const NEW_SUITE = "__new__";

export const GENERATE_FORM_FIELDS = ["projectId", "suiteId", "newSuiteName", "path", "description", "count"] as const;

/** Form input for "Generate". suiteId is an existing suite id or NEW_SUITE. */
export const generateInputSchema = z
  .object({
    projectId: z.uuid("Choose a project"),
    suiteId: z.union([z.uuid(), z.literal(NEW_SUITE)], { error: "Choose a suite" }),
    newSuiteName: z.string().trim().max(100, "Must be 100 characters or fewer"),
    path: z
      .string()
      .trim()
      .max(2048, "Path is too long")
      .transform((value) => value || "/")
      .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
        message: 'Start with "/" or use a full http(s) URL on the project',
      }),
    description: z
      .string()
      .trim()
      .min(10, "Describe what to test in at least 10 characters")
      .max(2000, "Must be 2000 characters or fewer"),
    count: z.coerce.number().int().min(1, "At least 1").max(MAX_TESTS, `At most ${MAX_TESTS}`),
  })
  .superRefine((input, ctx) => {
    if (input.suiteId === NEW_SUITE && input.newSuiteName.length === 0) {
      ctx.addIssue({ code: "custom", path: ["newSuiteName"], message: "Name the new suite" });
    }
  });

export type GenerateInput = z.output<typeof generateInputSchema>;

/**
 * Schema sent to Claude as the structured-output format. Deliberately loose:
 * the SDK's JSON-schema conversion turns literals, enums and length limits into
 * hints, so every field is a nullable primitive here and the strict
 * `testStepsSchema` validates the result afterwards (see `toGeneratedCases`).
 */
const generatedStepSchema = z.object({
  action: z.string().describe(
    "One of: goto, click, fill, press, select, check, hover, wait, expect-visible, expect-hidden, expect-text, expect-url, expect-title",
  ),
  path: z.string().nullable().describe("goto only: path starting with / on the project site"),
  selector: z.string().nullable().describe("Playwright selector, for actions that target an element"),
  value: z.string().nullable().describe("fill/select only"),
  key: z.string().nullable().describe("press only, e.g. Enter"),
  ms: z.number().nullable().describe("wait only, milliseconds 0-30000"),
  text: z.string().nullable().describe("expect-text/expect-title only"),
  pattern: z.string().nullable().describe("expect-url only: substring the URL must contain"),
});

export const generatedSuiteSchema = z.object({
  tests: z.array(
    z.object({
      name: z.string().describe("Short, unique test name, max 200 characters"),
      description: z.string().describe("One sentence: what the test verifies"),
      steps: z.array(generatedStepSchema),
    }),
  ),
});

export type GeneratedSuite = z.infer<typeof generatedSuiteSchema>;

/** A generated test ready for review. `errors` is set when Claude's steps failed strict validation. */
export type GeneratedCase = {
  name: string;
  description: string;
  stepsText: string;
  errors?: string[];
};

const STEP_FIELDS = ["path", "selector", "value", "key", "ms", "text", "pattern"] as const;

/** Normalises a root-relative path ("/a b?x" → "/a%20b?x") so equal pages compare equal. */
export function normalizePath(path: string): string | null {
  try {
    const url = new URL(path, "http://devpilot.invalid");
    if (url.origin !== "http://devpilot.invalid") return null;
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return null;
  }
}

/** Error when a test doesn't start on the page the user asked to test, else null. */
export function startPageError(steps: readonly TestStep[], requiredPath: string): string | null {
  const first = steps[0];
  if (first?.action === "goto" && normalizePath(first.path) === normalizePath(requiredPath)) return null;
  return `Must start with: goto ${requiredPath}`;
}

/**
 * Re-validates Claude's output with the real step schema and checks that every
 * test starts on `requiredPath`. Never trust model output as-is.
 */
export function toGeneratedCases(output: GeneratedSuite, limit: number, requiredPath: string): GeneratedCase[] {
  return output.tests.slice(0, limit).map((test, index) => {
    const name = (test.name.trim() || `Generated test ${index + 1}`).slice(0, 200);
    const description = test.description.trim().slice(0, 2000);

    // Keep only the fields that were provided; the strict schema rejects extras per action.
    const candidates = test.steps.map((step) => {
      const out: Record<string, unknown> = { action: step.action.trim() };
      for (const field of STEP_FIELDS) {
        const value = step[field];
        if (value !== null && value !== undefined) out[field] = value;
      }
      return out;
    });

    const parsed = testStepsSchema.safeParse(candidates);
    if (parsed.success) {
      const startError = startPageError(parsed.data, requiredPath);
      return {
        name,
        description,
        stepsText: formatStepsText(parsed.data),
        ...(startError ? { errors: [startError] } : {}),
      };
    }

    // Show what we can so the user can fix it in the editor.
    const valid: TestStep[] = [];
    const errors: string[] = [];
    for (const [i, candidate] of candidates.entries()) {
      const result = testStepsSchema.element.safeParse(candidate);
      if (result.success) valid.push(result.data);
      else errors.push(`Step ${i + 1} (${String(candidate.action)}): ${result.error.issues[0]?.message ?? "invalid"}`);
    }
    if (errors.length === 0) errors.push(parsed.error.issues[0]?.message ?? "Invalid steps");
    const startError = startPageError(valid, requiredPath);
    if (startError) errors.unshift(startError);
    return { name, description, stepsText: formatStepsText(valid), errors };
  });
}

export { hasAssertion } from "@/lib/test-steps";
