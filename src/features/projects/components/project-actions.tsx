"use client";

import { Trash2Icon } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { deleteProject, deleteSuite } from "../actions";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="outline">
          <Trash2Icon /> Delete
        </Button>
      }
      title={`Delete "${projectName}"?`}
      description="This permanently deletes the project with all of its test suites, runs, results and issues. This can't be undone."
      confirmLabel="Delete project"
      onConfirm={() => deleteProject(projectId)}
    />
  );
}

export function DeleteSuiteButton({
  projectId,
  suiteId,
  suiteName,
}: {
  projectId: string;
  suiteId: string;
  suiteName: string;
}) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete suite ${suiteName}`}>
          <Trash2Icon />
        </Button>
      }
      title={`Delete suite "${suiteName}"?`}
      description="Past runs of this suite are kept as history."
      onConfirm={() => deleteSuite(projectId, suiteId)}
    />
  );
}
