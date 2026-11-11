import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value === "" ? null : value));

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Must be 100 characters or fewer"),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(320, "Must be 320 characters or fewer")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email")
    .transform((value) => (value === "" ? null : value)),
  notes: optionalText(1000),
});

export type ClientInput = z.output<typeof clientInputSchema>;
export const CLIENT_FORM_FIELDS = ["name", "contactEmail", "notes"] as const;
