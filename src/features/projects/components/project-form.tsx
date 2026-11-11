"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { ENVIRONMENT_OPTIONS } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type ProjectFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Pick<Tables<"projects">, "name" | "description" | "base_url" | "environment" | "client_id">;
  /** Clients of the current workspace; the select is hidden when there are none. */
  clients?: readonly { id: string; name: string }[];
  /** Pre-selected client for new projects (e.g. from ?client=). */
  defaultClientId?: string;
  submitLabel: string;
  cancelHref: string;
};

export function ProjectForm({ action, project, clients = [], defaultClientId, submitLabel, cancelHref }: ProjectFormProps) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="grid max-w-xl gap-5" noValidate>
      <FormMessage state={state} />
      <TextField name="name" label="Project name" required maxLength={100} defaultValue={project?.name} state={state} />
      <TextField
        name="baseUrl"
        label="Website URL"
        required
        inputMode="url"
        placeholder="https://example.com"
        hint="The public URL DevPilot will run browser tests against."
        defaultValue={project?.base_url}
        state={state}
      />
      <SelectField
        name="environment"
        label="Environment"
        options={ENVIRONMENT_OPTIONS}
        defaultValue={project?.environment ?? "production"}
        state={state}
      />
      {clients.length > 0 && (
        <SelectField
          name="clientId"
          label="Client"
          options={[{ value: "", label: "No client" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          defaultValue={project?.client_id ?? defaultClientId ?? ""}
          hint="Optional. Groups the project under a client."
          state={state}
        />
      )}
      <TextAreaField
        name="description"
        label="Description"
        rows={3}
        maxLength={1000}
        hint="Optional."
        defaultValue={project?.description ?? ""}
        state={state}
      />
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
