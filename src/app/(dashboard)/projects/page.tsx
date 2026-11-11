import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BuildingIcon, FolderKanbanIcon, GlobeIcon, LayersIcon, PlusIcon, XIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { EnvironmentBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/features/clients/queries";
import { listProjects } from "@/features/projects/queries";
import { timeAgo } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Websites and apps you test with DevPilot."
        actions={
          <Link href="/projects/new" className={buttonVariants()}>
            <PlusIcon /> New project
          </Link>
        }
      />
      <Suspense fallback={<ProjectGridSkeleton />}>
        <ProjectGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProjectGrid({ searchParams }: Pick<PageProps<"/projects">, "searchParams">) {
  const { workspace } = await requireWorkspace();
  const { client: clientParam } = await searchParams;
  const filterClient = typeof clientParam === "string" ? await getClient(workspace.id, clientParam) : null;
  const projects = await listProjects(workspace.id, filterClient?.id);

  const filterBar = filterClient && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      Showing projects for
      <Badge variant="secondary">
        <BuildingIcon aria-hidden /> {filterClient.name}
      </Badge>
      <Link href="/projects" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <XIcon /> Clear filter
      </Link>
    </div>
  );

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {filterBar}
        <EmptyState
          icon={FolderKanbanIcon}
          title={filterClient ? "No projects for this client" : "No projects yet"}
          description="Create a project for each website you want to test."
          action={
            <Link
              href={filterClient ? `/projects/new?client=${filterClient.id}` : "/projects/new"}
              className={buttonVariants()}
            >
              <PlusIcon /> New project
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filterBar}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate">{project.name}</CardTitle>
                    <EnvironmentBadge environment={project.environment} />
                  </div>
                  <CardDescription className="flex items-center gap-1.5 truncate">
                    <GlobeIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{project.base_url}</span>
                  </CardDescription>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <LayersIcon className="size-3.5" aria-hidden />
                        {project.suiteCount} {project.suiteCount === 1 ? "suite" : "suites"}
                      </span>
                      {project.client && (
                        <Badge variant="secondary" className="max-w-32 truncate">
                          <BuildingIcon aria-hidden /> {project.client.name}
                        </Badge>
                      )}
                    </span>
                    <time dateTime={project.updated_at} className="shrink-0">
                      Updated {timeAgo(project.updated_at)}
                    </time>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
