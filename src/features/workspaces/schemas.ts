import { z } from "zod";

export const workspaceNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Must be 100 characters or fewer"),
});

export const WORKSPACE_FORM_FIELDS = ["name"] as const;
