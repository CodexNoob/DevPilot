"use client";

import { useActionState, useCallback, useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Field, FormMessage, SelectField, SubmitButton, TextField, fieldValue } from "@/components/forms";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { idleState, type ActionState } from "@/lib/action-state";
import { COMMON_TIMEZONES, CRON_PRESETS } from "../schemas";

type ScheduleValues = {
  name: string;
  cron: string;
  timezone: string;
  branch: string;
  suiteId: string | null;
  enabled: boolean;
};

type ScheduleDialogProps = {
  trigger: ReactElement;
  title: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  suites: { id: string; name: string }[];
  schedule?: ScheduleValues;
};

export function ScheduleDialog({ trigger, title, action, suites, schedule }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Runs are queued automatically at each scheduled time while the worker is running.</DialogDescription>
        </DialogHeader>
        {/* Remount on open so a previous submit's state doesn't linger. */}
        {open && <ScheduleForm action={action} suites={suites} schedule={schedule} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({
  action,
  suites,
  schedule,
  onDone,
}: Omit<ScheduleDialogProps, "trigger" | "title"> & { onDone: () => void }) {
  const [state, formAction] = useActionState(action, idleState);
  const [cron, setCron] = useState(schedule?.cron ?? "0 9 * * 1-5");

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const enabledDefault = state.status === "error" ? fieldValue(state, "enabled") === "on" : (schedule?.enabled ?? true);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="name" label="Name" required maxLength={100} placeholder="Weekday smoke tests" defaultValue={schedule?.name} state={state} />

      <Field
        name="cron"
        label="Cron expression"
        state={state}
        hint={
          <span className="flex flex-wrap gap-1.5">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.cron}
                type="button"
                onClick={() => setCron(preset.cron)}
                className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-muted"
              >
                {preset.label}
              </button>
            ))}
          </span>
        }
      >
        {(a11y) => (
          <Input
            {...a11y}
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            className="font-mono"
            placeholder="minute hour day month weekday"
            spellCheck={false}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="timezone"
          label="Time zone"
          list="schedule-timezones"
          defaultValue={schedule?.timezone ?? "UTC"}
          maxLength={64}
          state={state}
        />
        <datalist id="schedule-timezones">
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <TextField name="branch" label="Branch" defaultValue={schedule?.branch ?? "main"} maxLength={100} state={state} />
      </div>

      <SelectField
        name="suiteId"
        label="Suite"
        options={[{ value: "all", label: "All suites" }, ...suites.map((s) => ({ value: s.id, label: s.name }))]}
        defaultValue={schedule?.suiteId ?? "all"}
        state={state}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabledDefault}
          key={JSON.stringify(state)}
          className="size-4 accent-primary"
        />
        Enabled
      </label>

      <SubmitButton pendingLabel="Saving…">Save schedule</SubmitButton>
    </form>
  );
}
