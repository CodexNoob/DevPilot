import { z } from "zod";
import { INVITABLE_ROLES, normalizeEmail } from "@/features/workspaces/permissions";

export const inviteInputSchema = z.object({
  email: z.string().transform((value, ctx) => {
    const email = normalizeEmail(value);
    if (!email) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
      return z.NEVER;
    }
    return email;
  }),
  role: z.enum(INVITABLE_ROLES, { error: "Choose a role" }),
});

export const INVITE_FORM_FIELDS = ["email", "role"] as const;

export const roleSchema = z.enum(["owner", "admin", "member"]);
