import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listClientOptions } from "@/features/clients/queries";
import { createProject } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  return (
    <div className="space-y-8">
      <PageHeader title="New project" description="Register a website for DevPilot to test." />
      <Suspense fallback={<Skeleton className="h-96 max-w-xl rounded-xl" />}>
        <NewProjectForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewProjectForm({ searchParams }: Pick<PageProps<"/projects/new">, "searchParams">) {
  const { workspace } = await requireWorkspace();
  const [clients, { client }] = await Promise.all([listClientOptions(workspace.id), searchParams]);
  const defaultClientId = typeof client === "string" && clients.some((c) => c.id === client) ? client : undefined;

  return (
    <ProjectForm
      action={createProject}
      clients={clients}
      defaultClientId={defaultClientId}
      submitLabel="Create project"
      cancelHref="/projects"
    />
  );
}
