import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FolderKanbanIcon, MailIcon, PencilIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { EnvironmentBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteClientButton } from "@/features/clients/components/delete-client-button";
import { getClient } from "@/features/clients/queries";
import { listProjects } from "@/features/projects/queries";
import { timeAgo } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Client" };

export default function ClientPage({ params }: PageProps<"/clients/[clientId]">) {
  return (
    <Suspense fallback={<ClientSkeleton />}>
      <ClientDetail params={params} />
    </Suspense>
  );
}

async function ClientDetail({ params }: Pick<PageProps<"/clients/[clientId]">, "params">) {
  const { workspace, isAdmin } = await requireWorkspace();
  const { clientId } = await params;
  const client = await getClient(workspace.id, clientId);
  if (!client) notFound();
  const projects = await listProjects(workspace.id, client.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        description={
          client.contact_email ? (
            <a href={`mailto:${client.contact_email}`} className="inline-flex items-center gap-1.5 hover:underline">
              <MailIcon className="size-3.5" aria-hidden /> {client.contact_email}
            </a>
          ) : (
            "No contact email"
          )
        }
        actions={
          isAdmin && (
            <>
              <Link href={`/clients/${client.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <PencilIcon /> Edit
              </Link>
              <DeleteClientButton clientId={client.id} clientName={client.name} />
            </>
          )
        }
      />

      {client.notes && <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{client.notes}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderKanbanIcon}
              title="No projects for this client"
              description="Choose this client when creating or editing a project."
              action={
                <Link href="/projects/new" className={buttonVariants()}>
                  <PlusIcon /> New project
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">URL</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <Link href={`/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground sm:table-cell">
                      {project.base_url}
                    </TableCell>
                    <TableCell>
                      <EnvironmentBadge environment={project.environment} />
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                      {timeAgo(project.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading client">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
