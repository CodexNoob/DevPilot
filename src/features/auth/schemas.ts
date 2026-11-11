import { z } from "zod";

const email = z.email("Enter a valid email address").trim().toLowerCase().max(254);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(80, "Must be 80 characters or fewer"),
  email,
  // 72 is bcrypt's input limit, which Supabase Auth uses.
  password: z.string().min(8, "Use at least 8 characters").max(72, "Must be 72 characters or fewer"),
});

export const SIGN_IN_FIELDS = ["email", "password", "next"] as const;
export const SIGN_UP_FIELDS = ["displayName", "email", "password"] as const;
