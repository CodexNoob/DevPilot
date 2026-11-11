"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/forms";
import { idleState } from "@/lib/action-state";
import { inviteMember } from "../actions";

const ROLE_OPTIONS = [
  { value: "member", label: "Member: projects, tests and runs" },
  { value: "admin", label: "Admin: also members, clients and deletes" },
];

export function InviteForm() {
  const [state, formAction] = useActionState(inviteMember, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto] sm:items-start">
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="off"
          placeholder="teammate@example.com"
          required
          maxLength={320}
          state={state}
        />
        <SelectField name="role" label="Role" options={ROLE_OPTIONS} defaultValue="member" state={state} />
        <SubmitButton className="sm:mt-6" pendingLabel="Inviting…">
          Invite
        </SubmitButton>
      </div>
    </form>
  );
}
