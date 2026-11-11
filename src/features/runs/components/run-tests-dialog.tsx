"use client";

import { useActionState, useState } from "react";
import { PlayIcon } from "lucide-react";
import { Field, FormMessage, SubmitButton, TextField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/action-state";
import { queueRun } from "../actions";
import type { RunnableProject } from "../queries";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

/**
 * "Run tests" button + dialog. Pass a single project to lock the project
 * (project page), or several to let the user pick (/runs).
 */
export function RunTestsDialog({
  projects,
  defaultSuiteId,
  variant = "default",
}: {
  projects: RunnableProject[];
  defaultSuiteId?: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction] = useActionState(queueRun, idleState);
  // Preselect a project that actually has test cases, not just the first alphabetically.
  const [projectId, setProjectId] = useState(
    () => (projects.find((p) => projectCaseCount(p) > 0) ?? projects[0])?.id ?? "",
  );
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const [suiteId, setSuiteId] = useState(defaultSuiteId ?? "all");
  const locked = projects.length === 1;

  const selectedCount =
    suiteId === "all" ? (project ? projectCaseCount(project) : 0) : (project?.suites.find((s) => s.id === suiteId)?.caseCount ?? 0);
  const emptyHint = !project
    ? null
    : selectedCount > 0
      ? null
      : suiteId === "all"
        ? `${project.name} has no test cases yet. Add or generate some on the project page first.`
        : "This suite has no test cases yet. Pick another suite or add test cases first.";

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant={variant} disabled={projects.length === 0}>
            <PlayIcon /> Run tests
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run tests</DialogTitle>
          <DialogDescription>
            Queues a run. The DevPilot worker picks it up and runs the test cases in a real browser.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4" noValidate>
          <FormMessage state={state} />
          {locked ? (
            <input type="hidden" name="projectId" value={project?.id ?? ""} />
          ) : (
            <Field name="projectId" label="Project" state={state}>
              {(a11y) => (
                <select
                  {...a11y}
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSuiteId("all");
                  }}
                  className={selectClass}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({caseLabel(projectCaseCount(p))})
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field name="suiteId" label="Suite" state={state}>
            {(a11y) => (
              <select {...a11y} value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className={selectClass}>
                <option value="all">All suites ({caseLabel(project ? projectCaseCount(project) : 0)})</option>
                {project?.suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({caseLabel(s.caseCount)})
                  </option>
                ))}
              </select>
            )}
          </Field>
          {emptyHint && (
            <p role="status" className="text-sm text-muted-foreground">
              {emptyHint}
            </p>
          )}
          <TextField
            name="branch"
            label="Branch"
            defaultValue="main"
            maxLength={100}
            hint="A label for this run, e.g. the branch deployed to the project URL."
            state={state}
          />
          <SubmitButton pendingLabel="Queuing…" disabled={selectedCount === 0}>
            <PlayIcon /> Queue run
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function projectCaseCount(project: RunnableProject): number {
  return project.suites.reduce((total, s) => total + s.caseCount, 0);
}

function caseLabel(count: number): string {
  return count === 1 ? "1 test" : `${count} tests`;
}
