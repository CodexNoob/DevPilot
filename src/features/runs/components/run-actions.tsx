"use client";

import { useTransition } from "react";
import { Loader2Icon, RotateCcwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { cancelRun, rerun } from "../actions";

function useActionButton(action: () => Promise<ActionState>) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result?.status === "error") toast.error(result.message);
      else if (result?.status === "success") toast.success(result.message);
    });
  return [pending, run] as const;
}

export function CancelRunButton({ runId }: { runId: string }) {
  const [pending, run] = useActionButton(() => cancelRun(runId));
  return (
    <Button variant="outline" onClick={run} disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <XIcon />} Cancel run
    </Button>
  );
}

export function RerunButton({ runId }: { runId: string }) {
  const [pending, run] = useActionButton(() => rerun(runId));
  return (
    <Button onClick={run} disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <RotateCcwIcon />} Re-run
    </Button>
  );
}
