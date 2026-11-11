import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { updateProject } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";
import { getProject } from "@/features/projects/queries";
import { listClientOptions } from "@/features/clients/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit project" };

export default function EditProjectPage({ params }: PageProps<"/projects/[projectId]/edit">) {
  return (
    <div className="space-y-8">
      <PageHeader title="Edit project" description="Update the project's details and test configuration." />
      <Suspense fallback={<Skeleton className="h-96 max-w-xl rounded-xl" />}>
        <EditProject params={params} />
      </Suspense>
    </div>
  );
}

async function EditProject({ params }: Pick<PageProps<"/projects/[projectId]/edit">, "params">) {
  await requireUser();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  // The client list must come from the project's own workspace.
  const clients = await listClientOptions(project.workspace_id);

  return (
    <ProjectForm
      action={updateProject.bind(null, project.id)}
      project={project}
      clients={clients}
      submitLabel="Save changes"
      cancelHref={`/projects/${project.id}`}
    />
  );
}
