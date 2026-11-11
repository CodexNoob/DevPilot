import { z } from "zod";
import { hasAssertion, NO_ASSERTION_MESSAGE, parseStepsText, type TestStep } from "@/lib/test-steps";

export const TEST_CASE_FORM_FIELDS = ["name", "description", "suiteId", "steps"] as const;

/**
 * Validates the test-case form. `steps` is the text form of the step language;
 * every parse error becomes its own message on the `steps` field.
 */
export const testCaseInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Must be 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(2000, "Must be 2000 characters or fewer")
    .transform((value) => (value === "" ? null : value)),
  suiteId: z.uuid({ error: "Choose a suite" }),
  steps: z.string().transform((value, ctx): TestStep[] => {
    const result = parseStepsText(value);
    if (!result.ok) {
      for (const message of result.errors) ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    if (!hasAssertion(result.steps)) {
      ctx.addIssue({ code: "custom", message: NO_ASSERTION_MESSAGE });
      return z.NEVER;
    }
    return result.steps;
  }),
});

export type TestCaseInput = z.output<typeof testCaseInputSchema>;

/** Number of steps in a stored `steps` JSON value (tolerates bad data). */
export function stepCount(steps: unknown): number {
  return Array.isArray(steps) ? steps.length : 0;
}
