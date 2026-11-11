import { z } from "zod";
import { validateCron } from "@/lib/cron";
import { branchSchema } from "@/features/runs/format";

export const SCHEDULE_FORM_FIELDS = ["name", "cron", "timezone", "branch", "suiteId", "enabled"] as const;

export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
] as const;

export const CRON_PRESETS = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Daily at 09:00", cron: "0 9 * * *" },
  { label: "Weekdays at 09:00", cron: "0 9 * * 1-5" },
  { label: "Mondays at 08:00", cron: "0 8 * * 1" },
] as const;

export const scheduleInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Must be 100 characters or fewer"),
    cron: z.string().trim().min(1, "Cron expression is required").max(100),
    timezone: z.string().trim().min(1, "Time zone is required").max(64),
    branch: branchSchema,
    suiteId: z
      .string()
      .transform((value) => (value === "" || value === "all" ? null : value))
      .pipe(z.uuid({ error: "Choose a suite" }).nullable()),
    // Checkbox: present ("on") when checked, absent ("") otherwise.
    enabled: z.string().transform((value) => value === "on" || value === "true"),
  })
  .superRefine((input, ctx) => {
    const check = validateCron(input.cron, input.timezone);
    if (!check.ok) {
      const field = check.reason === "Unknown time zone" ? "timezone" : "cron";
      ctx.addIssue({ code: "custom", path: [field], message: check.reason });
    }
  });

export type ScheduleInput = z.output<typeof scheduleInputSchema>;
