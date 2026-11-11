"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField, fieldValue } from "@/components/forms";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState, type ActionState } from "@/lib/action-state";
import { StepCheatSheet } from "./step-cheat-sheet";

type TestCaseFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  suites: { id: string; name: string }[];
  testCase?: { name: string; description: string | null; suiteId: string; stepsText: string };
  defaultSuiteId?: string;
  submitLabel: string;
  cancelHref: string;
};

// Starts with a comment line so it can't be mistaken for steps already entered.
const PLACEHOLDER = `# Example only. Type your own steps here, one per line:
goto /
expect-title "Example"
click "text=Sign in"
fill "#email" "qa@example.com"
expect-visible "text=Welcome"`;

export function TestCaseForm({ action, suites, testCase, defaultSuiteId, submitLabel, cancelHref }: TestCaseFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const stepErrors = state.status === "error" ? (state.fieldErrors?.steps ?? []) : [];

  return (
    <form action={formAction} className="grid max-w-3xl gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label="Test name"
          required
          maxLength={200}
          placeholder="Visitor can sign in"
          defaultValue={testCase?.name}
          state={state}
        />
        <SelectField
          name="suiteId"
          label="Suite"
          options={suites.map((s) => ({ value: s.id, label: s.name }))}
          defaultValue={testCase?.suiteId ?? defaultSuiteId ?? suites[0]?.id}
          state={state}
        />
      </div>
      <TextAreaField
        name="description"
        label="Description"
        rows={2}
        maxLength={2000}
        hint="Optional. What this test proves."
        defaultValue={testCase?.description ?? ""}
        state={state}
      />

      <div className="grid gap-2">
        <Label htmlFor="field-steps">Steps</Label>
        <Textarea
          id="field-steps"
          name="steps"
          rows={14}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={PLACEHOLDER}
          aria-invalid={stepErrors.length > 0}
          aria-describedby={stepErrors.length > 0 ? "field-steps-error" : "field-steps-hint"}
          key={JSON.stringify(state)}
          defaultValue={fieldValue(state, "steps", testCase?.stepsText ?? "")}
          className="font-mono text-xs leading-relaxed"
        />
        {stepErrors.length > 0 ? (
          <ul id="field-steps-error" className="grid gap-1 text-sm text-destructive" role="alert">
            {stepErrors.map((error) => (
              <li key={error} className="flex items-start gap-1.5">
                <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {error === "Add at least one step"
                  ? "The Steps box is empty. The grey text is only an example: type your steps (or use Test Generator)."
                  : error}
              </li>
            ))}
          </ul>
        ) : (
          <p id="field-steps-hint" className="text-sm text-muted-foreground">
            One step per line. Lines starting with # are comments. Paths are relative to the project URL.
          </p>
        )}
        <StepCheatSheet />
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
