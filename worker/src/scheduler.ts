import { nextRunAt } from "../../src/lib/cron";
import { errorMessage, log } from "./log";
import type { WorkerClient } from "./supabase";

function safeNextRun(cron: string, timezone: string, from: Date): string | null {
  try {
    return nextRunAt(cron, timezone, from).toISOString();
  } catch (error) {
    log("warn", "Invalid schedule; leaving it without a next run", { cron, timezone, error: errorMessage(error) });
    return null;
  }
}

/**
 * Enqueues runs for due schedules. `claim_due_schedules` clears next_run_at
 * atomically (SKIP LOCKED), so concurrent workers never double-enqueue; this
 * worker then writes the next fire time.
 */
export async function schedulerTick(db: WorkerClient): Promise<void> {
  const now = new Date();

  const due = await db.rpc("claim_due_schedules");
  if (due.error) {
    log("error", "Failed to claim schedules", { error: due.error.message });
    return;
  }

  for (const schedule of due.data) {
    const insert = await db.from("test_runs").insert({
      project_id: schedule.project_id,
      suite_id: schedule.suite_id,
      branch: schedule.branch,
      trigger: "scheduled",
      schedule_id: schedule.id,
      triggered_by: null,
    });
    if (insert.error) log("error", "Failed to enqueue scheduled run", { schedule: schedule.name, error: insert.error.message });
    else log("info", "Enqueued scheduled run", { schedule: schedule.name });

    const update = await db
      .from("schedules")
      .update({ next_run_at: safeNextRun(schedule.cron, schedule.timezone, now) })
      .eq("id", schedule.id);
    if (update.error) log("error", "Failed to set next run", { schedule: schedule.name, error: update.error.message });
  }

  // Recovery: enabled schedules with no next run (new, or a worker died mid-claim).
  const orphans = await db.from("schedules").select("id, name, cron, timezone").eq("enabled", true).is("next_run_at", null);
  if (orphans.error) {
    log("error", "Failed to load schedules", { error: orphans.error.message });
    return;
  }
  for (const schedule of orphans.data) {
    const next = safeNextRun(schedule.cron, schedule.timezone, now);
    if (!next) continue;
    await db.from("schedules").update({ next_run_at: next }).eq("id", schedule.id).is("next_run_at", null);
  }
}
