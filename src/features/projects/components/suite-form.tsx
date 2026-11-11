"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton, TextField } from "@/components/forms";
import { idleState, type ActionState } from "@/lib/action-state";

export function SuiteForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-start">
        <TextField name="name" label="Suite name" placeholder="Checkout flow" maxLength={100} required state={state} />
        <TextField name="description" label="Description" placeholder="Optional" maxLength={1000} state={state} />
        <SubmitButton className="sm:mt-6" pendingLabel="Adding…">
          Add suite
        </SubmitButton>
      </div>
    </form>
  );
}
