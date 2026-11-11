"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { nextRunAt } from "@/lib/cron";
import { createClient } from "@/lib/supabase/server";
import { databaseError, formValues, validationError, type ActionState } from "@/lib/action-state";
import { SCHEDULE_FORM_FIELDS, scheduleInputSchema, type ScheduleInput } from "./schemas";

// The worker enqueues runs for due schedules (next_run_at <= now) and then
// advances next_run_at. The app sets the first next_run_at on save.

const idSchema = z.uuid();

function toRow(input: ScheduleInput) {
  return {
    name: input.name,
    cron: input.cron,
    timezone: input.timezone,
    branch: input.branch,
    suite_id: input.suiteId,
    enabled: input.enabled,
    next_run_at: input.enabled ? nextRunAt(input.cron, input.timezone, new Date()).toISOString() : null,
  };
}

export async function createSchedule(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success) return { status: "error", message: "Project not found." };

  const values = formValues(formData, SCHEDULE_FORM_FIELDS);
  const parsed = scheduleInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("schedules").insert({ project_id: projectId, ...toRow(parsed.data) });
  if (error?.code === "23503") return { status: "error", message: "Suite not found.", values };
  if (error) return databaseError(error, { values });
  refresh();
  return { status: "success", message: `Schedule "${parsed.data.name}" created.` };
}

export async function updateSchedule(
  projectId: string,
  scheduleId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(scheduleId).success) {
    return { status: "error", message: "Schedule not found." };
  }

  const values = formValues(formData, SCHEDULE_FORM_FIELDS);
  const parsed = scheduleInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedules")
    .update(toRow(parsed.data))
    .eq("id", scheduleId)
    .eq("project_id", projectId)
    .select("id");
  if (error?.code === "23503") return { status: "error", message: "Suite not found.", values };
  if (error) return databaseError(error, { values });
  if (data.length === 0) return { status: "error", message: "Schedule not found.", values };
  refresh();
  return { status: "success", message: "Schedule saved." };
}

export async function setScheduleEnabled(projectId: string, scheduleId: string, enabled: boolean): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(scheduleId).success) {
    return { status: "error", message: "Schedule not found." };
  }

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("schedules")
    .select("cron, timezone")
    .eq("id", scheduleId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (readError) return databaseError(readError);
  if (!current) return { status: "error", message: "Schedule not found." };

  const { data, error } = await supabase
    .from("schedules")
    .update({
      enabled,
      next_run_at: enabled ? nextRunAt(current.cron, current.timezone, new Date()).toISOString() : null,
    })
    .eq("id", scheduleId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Schedule not found." };
  refresh();
  return { status: "success", message: enabled ? "Schedule enabled." : "Schedule paused." };
}

export async function deleteSchedule(projectId: string, scheduleId: string): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(scheduleId).success) {
    return { status: "error", message: "Schedule not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "Schedule not found." };
  refresh();
  return { status: "success", message: "Schedule deleted." };
}
