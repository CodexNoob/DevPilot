"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeRedirectPath } from "@/lib/routes";
import { formValues, validationError, type ActionState } from "@/lib/action-state";
import { SIGN_IN_FIELDS, SIGN_UP_FIELDS, signInSchema, signUpSchema } from "./schemas";

/** Never echo passwords back to the client. */
function withoutPassword<T extends { password: string }>(values: T): Omit<T, "password"> {
  const rest: Partial<T> = { ...values };
  delete rest.password;
  return rest as Omit<T, "password">;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, SIGN_IN_FIELDS);
  const safeValues = withoutPassword(values);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, safeValues);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // One generic message for wrong email *or* password avoids account enumeration.
    const message =
      error.code === "email_not_confirmed"
        ? "Please confirm your email address first. Check your inbox."
        : "Invalid email or password.";
    return { status: "error", message, values: safeValues };
  }

  redirect(safeRedirectPath(values.next));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, SIGN_UP_FIELDS);
  const next = formData.get("next");
  const nextPath = safeRedirectPath(typeof next === "string" ? next : undefined);
  const safeValues = withoutPassword(values);
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, safeValues);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "That password is too weak. Try a longer one."
        : error.code === "over_email_send_rate_limit"
          ? "Too many attempts. Please wait a minute and try again."
          : "We couldn't create your account. Please try again.";
    if (error.code !== "weak_password") console.error("[auth.signUp]", error.code, error.message);
    return { status: "error", message, values: safeValues };
  }

  // With email confirmation enabled (the default), there is no session yet.
  if (!data.session) {
    return {
      status: "success",
      message: `Check ${parsed.data.email} for a confirmation link to finish signing up.`,
    };
  }
  redirect(nextPath);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
