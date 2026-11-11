"use client";

import { useFormStatus } from "react-dom";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SubmitButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled} aria-disabled={pending}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Form-level status banner for an ActionState. */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <Alert variant={isError ? "destructive" : "default"} role={isError ? "alert" : "status"}>
      {isError ? <AlertCircleIcon /> : <CheckCircle2Icon />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

/** Returns the submitted value after a failed submit, else the fallback. */
export function fieldValue(state: ActionState, name: string, fallback = ""): string {
  return state.status === "error" && state.values?.[name] !== undefined ? state.values[name] : fallback;
}

function fieldError(state: ActionState, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[name]?.[0] : undefined;
}

type FieldProps = {
  name: string;
  label: string;
  state: ActionState;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

/** Label + control + hint/error, wired up for accessibility. */
export function Field({ name, label, state, hint, className, children }: FieldProps) {
  const id = `field-${name}`;
  const error = fieldError(state, name);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, name, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<FieldProps, "children"> &
  Omit<ComponentProps<typeof Input>, "name" | "id"> & { defaultValue?: string };

export function TextField({ name, label, state, hint, className, defaultValue = "", ...inputProps }: TextFieldProps) {
  return (
    <Field name={name} label={label} state={state} hint={hint} className={className}>
      {(a11y) => (
        <Input
          {...inputProps}
          {...a11y}
          // Remount on each submit result so the repopulated value is applied.
          key={JSON.stringify(state)}
          defaultValue={inputProps.type === "password" ? undefined : fieldValue(state, name, defaultValue)}
        />
      )}
    </Field>
  );
}

type TextAreaFieldProps = Omit<FieldProps, "children"> &
  Omit<ComponentProps<typeof Textarea>, "name" | "id"> & { defaultValue?: string };

export function TextAreaField({ name, label, state, hint, className, defaultValue = "", ...props }: TextAreaFieldProps) {
  return (
    <Field name={name} label={label} state={state} hint={hint} className={className}>
      {(a11y) => (
        <Textarea {...props} {...a11y} key={JSON.stringify(state)} defaultValue={fieldValue(state, name, defaultValue)} />
      )}
    </Field>
  );
}

type SelectFieldProps = Omit<FieldProps, "children"> & {
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
};

/** Native select: works without JS and submits with the form as-is. */
export function SelectField({ name, label, state, hint, className, options, defaultValue = "" }: SelectFieldProps) {
  return (
    <Field name={name} label={label} state={state} hint={hint} className={className}>
      {(a11y) => (
        <select
          key={JSON.stringify(state)}
          {...a11y}
          defaultValue={fieldValue(state, name, defaultValue)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
