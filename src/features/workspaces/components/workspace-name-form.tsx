"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton, TextField } from "@/components/forms";
import { idleState, type ActionState } from "@/lib/action-state";

/** Single-field form used to create or rename a workspace. */
export function WorkspaceNameForm({
  action,
  defaultName = "",
  label = "Workspace name",
  submitLabel,
  disabled,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultName?: string;
  label?: string;
  submitLabel: string;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <TextField
          name="name"
          label={label}
          required
          maxLength={100}
          defaultValue={defaultName}
          disabled={disabled}
          state={state}
        />
        <SubmitButton className="sm:mt-6" pendingLabel="Saving…" disabled={disabled}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
