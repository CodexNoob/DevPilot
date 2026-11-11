"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FormMessage, SubmitButton, TextField } from "@/components/forms";
import { idleState } from "@/lib/action-state";
import { signUp } from "../actions";

export function SignupForm() {
  const searchParams = useSearchParams();
  const [state, action] = useActionState(signUp, idleState);

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <TextField name="displayName" label="Name" autoComplete="name" required state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        state={state}
      />
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
