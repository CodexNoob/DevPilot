"use client";

import { Trash2Icon } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { deleteTestCase } from "../actions";

export function DeleteTestCaseButton({
  projectId,
  caseId,
  caseName,
}: {
  projectId: string;
  caseId: string;
  caseName: string;
}) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete test case ${caseName}`}>
          <Trash2Icon />
        </Button>
      }
      title={`Delete test case "${caseName}"?`}
      description="Past results of this test are kept as history."
      onConfirm={() => deleteTestCase(projectId, caseId)}
    />
  );
}
