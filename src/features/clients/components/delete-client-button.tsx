"use client";

import { Trash2Icon } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { deleteClientAction } from "../actions";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="outline">
          <Trash2Icon /> Delete
        </Button>
      }
      title={`Delete client "${clientName}"?`}
      description="Its projects are kept and simply become unassigned."
      confirmLabel="Delete client"
      onConfirm={() => deleteClientAction(clientId)}
    />
  );
}
