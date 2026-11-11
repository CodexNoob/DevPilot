"use client";

import { useActionState, useState } from "react";
import { AlertTriangleIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { Field, FormMessage, SubmitButton, TextAreaField, TextField, fieldValue } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { STEP_ACTIONS } from "@/lib/test-steps";
import { generateTests, saveGeneratedTests, type GenerateState, type SaveState } from "../actions";
import type { GeneratorProject } from "../queries";
import { MAX_TESTS, NEW_SUITE } from "../schemas";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

const idle: GenerateState = { status: "idle" };
const saveIdle: SaveState = { status: "idle" };

/** The shared form helpers take ActionState; GenerateState's error/idle shapes are compatible. */
const asActionState = (state: GenerateState): ActionState =>
  state.status === "success" ? { status: "idle" } : (state as ActionState);

export function GeneratorForm({ projects }: { projects: GeneratorProject[] }) {
  const [state, formAction, pending] = useActionState(generateTests, idle);
  const [dismissed, setDismissed] = useState<GenerateState | null>(null);

  if (state.status === "success" && dismissed !== state) {
    return <ReviewForm result={state} onStartOver={() => setDismissed(state)} />;
  }

  return <GenerateForm projects={projects} state={state} formAction={formAction} pending={pending} />;
}

function GenerateForm({
  projects,
  state,
  formAction,
  pending,
}: {
  projects: GeneratorProject[];
  state: GenerateState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const formState = asActionState(state);
  const [projectId, setProjectId] = useState(() => fieldValue(formState, "projectId", projects[0]?.id ?? ""));
  const project = projects.find((p) => p.id === projectId);
  const [suiteId, setSuiteId] = useState(() => fieldValue(formState, "suiteId", project?.suites[0]?.id ?? NEW_SUITE));
  const suiteOptions = project?.suites ?? [];
  const effectiveSuiteId = suiteId === NEW_SUITE || suiteOptions.some((s) => s.id === suiteId) ? suiteId : NEW_SUITE;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Describe what to test</CardTitle>
        <CardDescription>
          DevPilot opens the exact page you enter in a real browser, then Claude drafts tests from what is on it and
          your description. Every test starts on that page. Review each test before saving. The DevPilot worker
          must be running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-5" noValidate aria-busy={pending}>
          <FormMessage state={formState} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="projectId" label="Project" state={formState}>
              {(a11y) => (
                <select
                  {...a11y}
                  className={selectClass}
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    const next = projects.find((p) => p.id === e.target.value);
                    setSuiteId(next?.suites[0]?.id ?? NEW_SUITE);
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field name="suiteId" label="Save to suite" state={formState}>
              {(a11y) => (
                <select
                  {...a11y}
                  className={selectClass}
                  value={effectiveSuiteId}
                  onChange={(e) => setSuiteId(e.target.value)}
                >
                  {suiteOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={NEW_SUITE}>+ New suite…</option>
                </select>
              )}
            </Field>
          </div>

          {effectiveSuiteId === NEW_SUITE && (
            <TextField
              name="newSuiteName"
              label="New suite name"
              placeholder="Checkout"
              maxLength={100}
              state={formState}
            />
          )}
          {effectiveSuiteId !== NEW_SUITE && <input type="hidden" name="newSuiteName" value="" />}

          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <TextField
              name="path"
              label="Page"
              placeholder="/"
              defaultValue="/"
              maxLength={2048}
              hint={project ? `Path or full URL on ${project.baseUrl}. This is the page DevPilot opens and tests.` : undefined}
              state={formState}
            />
            <TextField
              name="count"
              label="Tests"
              type="number"
              min={1}
              max={MAX_TESTS}
              defaultValue="3"
              state={formState}
            />
          </div>

          <TextAreaField
            name="description"
            label="What should be tested?"
            rows={5}
            maxLength={2000}
            placeholder="Visitors can search for a product, add it to the cart and see the cart count update. The search box is in the header."
            hint="Describe user flows and what should be visible afterwards. Mention form fields, button labels and test accounts if you know them."
            state={formState}
          />

          <div>
            <SubmitButton pendingLabel="Opening the page and generating… (this can take a minute)">
              <SparklesIcon /> Generate tests
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReviewForm({
  result,
  onStartOver,
}: {
  result: Extract<GenerateState, { status: "success" }>;
  onStartOver: () => void;
}) {
  const [state, formAction] = useActionState(saveGeneratedTests, saveIdle);
  const caseErrors = state.status === "error" ? (state.caseErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="projectId" value={result.projectId} />
      <input type="hidden" name="suiteId" value={result.suiteId ?? ""} />
      <input type="hidden" name="suiteName" value={result.suiteName} />
      <input type="hidden" name="count" value={result.cases.length} />
      <input type="hidden" name="path" value={result.page.path} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.cases.length} generated {result.cases.length === 1 ? "test" : "tests"} for{" "}
          <span className="font-medium text-foreground">{result.projectName}</span> →{" "}
          <span className="font-medium text-foreground">{result.suiteName}</span>
          {result.suiteId === null && " (new suite)"}. Review and edit the steps, then save.
        </p>
        <Button type="button" variant="outline" onClick={onStartOver}>
          <RotateCcwIcon /> Start over
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <p>
          Built from{" "}
          <a href={result.page.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            {result.page.url}
          </a>
          {result.page.title && <> (&ldquo;{result.page.title}&rdquo;)</>}, opened just now.
        </p>
        {result.page.redirected && (
          <p className="mt-1 flex gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              That page redirected to {result.page.finalUrl}. If it&rsquo;s a login page, the tests need to sign in
              first or point at a page that is publicly reachable.
            </span>
          </p>
        )}
      </div>

      {state.status === "error" && <FormMessage state={{ status: "error", message: state.message }} />}

      {result.cases.map((testCase, i) => {
        const errors = caseErrors[i] ?? testCase.errors;
        const id = `case-${i}`;
        return (
          <Card key={i} aria-invalid={Boolean(errors?.length)} className={errors?.length ? "ring-destructive/50" : ""}>
            <CardHeader className="gap-3">
              <div className="flex items-start gap-3">
                <input
                  id={`${id}-include`}
                  type="checkbox"
                  name={`include_${i}`}
                  defaultChecked={!testCase.errors?.length}
                  className="mt-2 size-4 accent-primary"
                  aria-label={`Include "${testCase.name}"`}
                />
                <div className="grid flex-1 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-name`}>Test name</Label>
                    <Input id={`${id}-name`} name={`name_${i}`} defaultValue={testCase.name} maxLength={200} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-description`}>Description</Label>
                    <Input
                      id={`${id}-description`}
                      name={`description_${i}`}
                      defaultValue={testCase.description}
                      maxLength={2000}
                    />
                  </div>
                </div>
                {testCase.errors?.length ? (
                  <Badge variant="outline" className="shrink-0 text-amber-700 dark:text-amber-300">
                    Needs fixes
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Label htmlFor={`${id}-steps`}>Steps</Label>
              <Textarea
                id={`${id}-steps`}
                name={`steps_${i}`}
                defaultValue={testCase.stepsText}
                rows={Math.min(16, Math.max(4, testCase.stepsText.split("\n").length + 1))}
                spellCheck={false}
                className="font-mono text-xs"
                aria-invalid={Boolean(errors?.length)}
                aria-describedby={errors?.length ? `${id}-errors` : `${id}-hint`}
              />
              {errors?.length ? (
                <ul id={`${id}-errors`} className="space-y-1 text-sm text-destructive" role="alert">
                  {errors.map((error) => (
                    <li key={error} className="flex gap-1.5">
                      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {error}
                    </li>
                  ))}
                </ul>
              ) : (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                  One step per line. Actions: {STEP_ACTIONS.join(", ")}.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Save selected tests</SubmitButton>
      </div>
    </form>
  );
}
