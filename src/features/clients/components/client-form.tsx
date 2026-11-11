"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { buttonVariants } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";

type ClientFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  client?: { name: string; contact_email: string | null; notes: string | null };
  submitLabel: string;
  cancelHref?: string;
};

/** Create (inline, resets on success) or edit (redirects on success) a client. */
export function ClientForm({ action, client, submitLabel, cancelHref }: ClientFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Client name" required maxLength={100} defaultValue={client?.name} state={state} />
        <TextField
          name="contactEmail"
          label="Contact email"
          type="email"
          maxLength={320}
          hint="Optional."
          defaultValue={client?.contact_email ?? ""}
          state={state}
        />
      </div>
      <TextAreaField
        name="notes"
        label="Notes"
        rows={2}
        maxLength={1000}
        hint="Optional."
        defaultValue={client?.notes ?? ""}
        state={state}
      />
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        {cancelHref && (
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
