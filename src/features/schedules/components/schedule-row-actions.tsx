"use client";

import { useTransition } from "react";
import { Loader2Icon, PauseIcon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { deleteSchedule, setScheduleEnabled, updateSchedule } from "../actions";
import type { ScheduleSummary } from "../queries";
import { ScheduleDialog } from "./schedule-dialog";

export function ScheduleRowActions({
  projectId,
  schedule,
  suites,
}: {
  projectId: string;
  schedule: ScheduleSummary;
  suites: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setScheduleEnabled(projectId, schedule.id, !schedule.enabled);
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success") toast.success(result.message);
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        disabled={pending}
        aria-label={schedule.enabled ? `Pause schedule ${schedule.name}` : `Enable schedule ${schedule.name}`}
      >
        {pending ? <Loader2Icon className="animate-spin" /> : schedule.enabled ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <ScheduleDialog
        title="Edit schedule"
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Edit schedule ${schedule.name}`}>
            <PencilIcon />
          </Button>
        }
        action={updateSchedule.bind(null, projectId, schedule.id)}
        suites={suites}
        schedule={{
          name: schedule.name,
          cron: schedule.cron,
          timezone: schedule.timezone,
          branch: schedule.branch,
          suiteId: schedule.suite_id,
          enabled: schedule.enabled,
        }}
      />
      <ConfirmDelete
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Delete schedule ${schedule.name}`}>
            <Trash2Icon />
          </Button>
        }
        title={`Delete schedule "${schedule.name}"?`}
        description="Runs it already queued are kept."
        onConfirm={() => deleteSchedule(projectId, schedule.id)}
      />
    </div>
  );
}
