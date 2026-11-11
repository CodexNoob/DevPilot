"use client";

import { useId, useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspace } from "../actions";

/** Owner-only destructive action; the workspace name must be typed to enable it. */
export function DeleteWorkspaceDialog({ workspaceName }: { workspaceName: string }) {
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const matches = typed.trim() === workspaceName;

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteWorkspace(typed);
      if (result?.status === "error") toast.error(result.message);
    });
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && setTyped("")}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive">
            <Trash2Icon /> Delete workspace
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{workspaceName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the workspace with all of its clients, projects, test runs, results and schedules,
            and removes every member. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={inputId}>Type the workspace name to confirm</Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            placeholder={workspaceName}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm} disabled={!matches || pending}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Delete workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
