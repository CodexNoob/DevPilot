import { z } from "zod";

/**
 * The executable test-step language shared by the web app (editor and
 * validation), the AI test generator (structured output schema) and the
 * Playwright worker (execution). Keep this module dependency-free apart from
 * zod: the worker imports it directly.
 *
 * Text form (one step per line, used by the step editor):
 *
 *   goto /checkout
 *   click "button[type=submit]"
 *   fill "#email" "jane@example.com"
 *   press "#search" "Enter"
 *   select "#country" "PH"
 *   check "#terms"
 *   hover "nav >> text=Products"
 *   wait 500
 *   expect-visible "text=Order confirmed"
 *   expect-hidden ".spinner"
 *   expect-text "h1" "Thank you"
 *   expect-url "/checkout/success"
 *   expect-title "Checkout"
 *
 * Selectors are Playwright selectors (CSS, `text=`, `role=`, `>>` chains).
 */

const selector = z.string().trim().min(1, "Selector is required").max(500, "Selector is too long");
const text = (label: string) => z.string().max(1000, `${label} is too long`);

/** Same-site path ("/pricing", "?q=x") or absolute http(s) URL. Checked against the project URL by the worker. */
const path = z
  .string()
  .trim()
  .min(1, "Path is required")
  .max(2048, "Path is too long")
  .refine((value) => /^(\/|\?|#)/.test(value) || /^https?:\/\//i.test(value), {
    message: 'Path must start with "/" or be an http(s) URL',
  });

export const testStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), path }),
  z.object({ action: z.literal("click"), selector }),
  z.object({ action: z.literal("fill"), selector, value: text("Value") }),
  z.object({ action: z.literal("press"), selector, key: z.string().trim().min(1).max(50) }),
  z.object({ action: z.literal("select"), selector, value: text("Value") }),
  z.object({ action: z.literal("check"), selector }),
  z.object({ action: z.literal("hover"), selector }),
  z.object({ action: z.literal("wait"), ms: z.number().int().min(0).max(30_000) }),
  z.object({ action: z.literal("expect-visible"), selector }),
  z.object({ action: z.literal("expect-hidden"), selector }),
  z.object({ action: z.literal("expect-text"), selector, text: text("Text").min(1, "Text is required") }),
  z.object({ action: z.literal("expect-url"), pattern: z.string().trim().min(1).max(2048) }),
  z.object({ action: z.literal("expect-title"), text: text("Title").min(1, "Title is required") }),
]);

export type TestStep = z.infer<typeof testStepSchema>;
export type TestStepAction = TestStep["action"];

export const MAX_STEPS = 100;
export const testStepsSchema = z
  .array(testStepSchema)
  .min(1, "Add at least one step")
  .max(MAX_STEPS, `A test can have at most ${MAX_STEPS} steps`);

/** True when the steps check something. A test without an expect-* step can only ever pass. */
export function hasAssertion(steps: readonly TestStep[]): boolean {
  return steps.some((step) => step.action.startsWith("expect-"));
}

export const NO_ASSERTION_MESSAGE =
  "Add at least one expect-* step so the test checks something, using text that is really on your page (e.g. expect-title with your site's actual tab title)";

/** Argument names per action, in text-form order. */
const ARGS: { [A in TestStepAction]: readonly Exclude<keyof Extract<TestStep, { action: A }>, "action">[] } = {
  goto: ["path"],
  click: ["selector"],
  fill: ["selector", "value"],
  press: ["selector", "key"],
  select: ["selector", "value"],
  check: ["selector"],
  hover: ["selector"],
  wait: ["ms"],
  "expect-visible": ["selector"],
  "expect-hidden": ["selector"],
  "expect-text": ["selector", "text"],
  "expect-url": ["pattern"],
  "expect-title": ["text"],
};

export const STEP_ACTIONS = Object.keys(ARGS) as TestStepAction[];

/** Splits a line into tokens; double-quoted tokens may contain spaces and \" or \\ escapes. */
function tokenize(line: string): string[] | { error: string } {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === '"') {
      let value = "";
      i++;
      let closed = false;
      while (i < line.length) {
        const c = line[i]!;
        if (c === "\\" && i + 1 < line.length) {
          value += line[i + 1];
          i += 2;
          continue;
        }
        if (c === '"') {
          closed = true;
          i++;
          break;
        }
        value += c;
        i++;
      }
      if (!closed) return { error: "Unclosed quote" };
      tokens.push(value);
      continue;
    }
    let value = "";
    while (i < line.length && line[i] !== " " && line[i] !== "\t") value += line[i++];
    tokens.push(value);
  }
  return tokens;
}

export type ParseStepsResult = { ok: true; steps: TestStep[] } | { ok: false; errors: string[] };

/** Parses the text form. Blank lines and lines starting with # are ignored. */
export function parseStepsText(input: string): ParseStepsResult {
  const steps: TestStep[] = [];
  const errors: string[] = [];

  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const where = `Line ${index + 1}`;

    const tokens = tokenize(line);
    if (!Array.isArray(tokens)) {
      errors.push(`${where}: ${tokens.error}`);
      return;
    }
    const [action, ...args] = tokens;
    if (!action || !(action in ARGS)) {
      errors.push(`${where}: unknown action "${action}". Use one of: ${STEP_ACTIONS.join(", ")}`);
      return;
    }
    const names = ARGS[action as TestStepAction];
    if (args.length !== names.length) {
      errors.push(`${where}: "${action}" takes ${names.length} argument(s): ${names.join(", ")}`);
      return;
    }

    const candidate: Record<string, unknown> = { action };
    names.forEach((name, i) => {
      candidate[name] = name === "ms" ? Number(args[i]) : args[i];
    });
    const parsed = testStepSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push(`${where}: ${parsed.error.issues[0]?.message ?? "invalid step"}`);
      return;
    }
    steps.push(parsed.data);
  });

  if (errors.length) return { ok: false, errors };
  const all = testStepsSchema.safeParse(steps);
  if (!all.success) return { ok: false, errors: [all.error.issues[0]?.message ?? "Invalid steps"] };
  return { ok: true, steps: all.data };
}

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Formats steps back into the text form (inverse of parseStepsText). */
export function formatStepsText(steps: readonly TestStep[]): string {
  return steps
    .map((step) => {
      const names = ARGS[step.action] as readonly string[];
      const args = names.map((name) => {
        const value = (step as Record<string, unknown>)[name];
        if (typeof value === "number") return String(value);
        if (name === "path" && typeof value === "string" && !/\s|"/.test(value)) return value;
        return quote(String(value));
      });
      return [step.action, ...args].join(" ");
    })
    .join("\n");
}

/** One-line human description, used in run results and logs. */
export function describeStep(step: TestStep): string {
  switch (step.action) {
    case "goto":
      return `Go to ${step.path}`;
    case "click":
      return `Click ${step.selector}`;
    case "fill":
      return `Fill ${step.selector}`;
    case "press":
      return `Press ${step.key} in ${step.selector}`;
    case "select":
      return `Select "${step.value}" in ${step.selector}`;
    case "check":
      return `Check ${step.selector}`;
    case "hover":
      return `Hover ${step.selector}`;
    case "wait":
      return `Wait ${step.ms} ms`;
    case "expect-visible":
      return `Expect ${step.selector} to be visible`;
    case "expect-hidden":
      return `Expect ${step.selector} to be hidden`;
    case "expect-text":
      return `Expect ${step.selector} to contain "${step.text}"`;
    case "expect-url":
      return `Expect URL to contain ${step.pattern}`;
    case "expect-title":
      return `Expect title to contain "${step.text}"`;
  }
}
