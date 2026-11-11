"use client";

import { useTransition, type ReactElement } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionState } from "@/lib/action-state";

type ConfirmDeleteProps = {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Server Action to run. May redirect on success, or return an ActionState. */
  onConfirm: () => Promise<ActionState | void>;
};

/** Destructive confirmation dialog wired to a Server Action. */
export function ConfirmDelete({ trigger, title, description, confirmLabel = "Delete", onConfirm }: ConfirmDeleteProps) {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result?.status === "error") toast.error(result.message);
      else if (result?.status === "success") toast.success(result.message);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
