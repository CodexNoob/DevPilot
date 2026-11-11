"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FormMessage, SubmitButton, TextField } from "@/components/forms";
import { idleState, type ActionState } from "@/lib/action-state";
import { signIn } from "../actions";

const URL_ERRORS: Record<string, string> = {
  confirmation_failed: "That confirmation link is invalid or has expired. Try signing in, or sign up again.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = URL_ERRORS[searchParams.get("error") ?? ""];
  const initial: ActionState = urlError ? { status: "error", message: urlError } : idleState;
  const [state, action] = useActionState(signIn, initial);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        state={state}
      />
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
