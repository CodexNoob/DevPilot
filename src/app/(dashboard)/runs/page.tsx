import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RunAutoRefresh } from "@/features/runs/components/run-auto-refresh";
import { RunTestsDialog } from "@/features/runs/components/run-tests-dialog";
import { RunsTable } from "@/features/runs/components/runs-table";
import { ACTIVE_RUN_STATUSES, parseRunFilters, RUN_STATUSES, RUNS_PAGE_SIZE, runsHref } from "@/features/runs/format";
import { listRunnableProjects, listWorkspaceRuns } from "@/features/runs/queries";
import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Test runs" };

export default function RunsPage({ searchParams }: PageProps<"/runs">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<RunsSkeleton />}>
        <Runs searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const STATUS_LABEL: Record<(typeof RUN_STATUSES)[number], string> = {
  queued: "Queued",
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  cancelled: "Cancelled",
  error: "Error",
};

async function Runs({ searchParams }: Pick<PageProps<"/runs">, "searchParams">) {
  const { workspace } = await requireWorkspace();
  const filters = parseRunFilters(await searchParams);
  const [projects, { runs, total }] = await Promise.all([
    listRunnableProjects(workspace.id),
    listWorkspaceRuns(workspace.id, filters),
  ]);
  const pages = Math.max(1, Math.ceil(total / RUNS_PAGE_SIZE));
  const hasActive = runs.some((r) => ACTIVE_RUN_STATUSES.includes(r.status));

  return (
    <>
      <PageHeader
        title="Test runs"
        description="Every test run across this workspace's projects."
        actions={<RunTestsDialog projects={projects} />}
      />
      <RunAutoRefresh active={hasActive} intervalMs={5000} />

      {/* Plain GET form: works without JS, keeps filters in the URL. */}
      <form action="/runs" className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter runs">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Project</span>
          <select name="project" defaultValue={filters.projectId ?? ""} className={selectClass}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">Any status</option>
            {RUN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Apply
        </button>
        {(filters.projectId || filters.status) && (
          <Link href="/runs" className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      <Card>
        <CardContent>
          {runs.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title={filters.projectId || filters.status ? "No matching runs" : "No test runs yet"}
              description={
                projects.length === 0
                  ? "Create a project and add test cases, then run them from here."
                  : "Click Run tests to queue a run. The DevPilot worker must be running to pick it up."
              }
            />
          ) : (
            <RunsTable runs={runs} />
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {filters.page} of {pages} · {total} runs
          </span>
          <div className="flex gap-2">
            <PageLink href={runsHref({ ...filters, page: filters.page - 1 })} disabled={filters.page <= 1}>
              <ChevronLeftIcon /> Previous
            </PageLink>
            <PageLink href={runsHref({ ...filters, page: filters.page + 1 })} disabled={filters.page >= pages}>
              Next <ChevronRightIcon />
            </PageLink>
          </div>
        </nav>
      )}
    </>
  );
}

const selectClass =
  "h-8 min-w-40 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
      {children}
    </Link>
  );
}

function RunsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading runs">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-12 w-96" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
