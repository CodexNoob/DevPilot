import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ActivityIcon,
  CalendarClockIcon,
  ExternalLinkIcon,
  FileCode2Icon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { EnvironmentBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createSuite } from "@/features/projects/actions";
import { DeleteProjectButton, DeleteSuiteButton } from "@/features/projects/components/project-actions";
import { SuiteForm } from "@/features/projects/components/suite-form";
import { getProject, listSuites } from "@/features/projects/queries";
import { RunTestsDialog } from "@/features/runs/components/run-tests-dialog";
import { RunsTable } from "@/features/runs/components/runs-table";
import { listProjectRuns } from "@/features/runs/queries";
import { createSchedule } from "@/features/schedules/actions";
import { ScheduleDialog } from "@/features/schedules/components/schedule-dialog";
import { ScheduleRowActions } from "@/features/schedules/components/schedule-row-actions";
import { listSchedules } from "@/features/schedules/queries";
import { DeleteTestCaseButton } from "@/features/test-cases/components/delete-test-case-button";
import { listTestCases, type TestCaseSummary } from "@/features/test-cases/queries";
import { stepCount } from "@/features/test-cases/schemas";
import { requireUser } from "@/lib/auth";
import { listMyWorkspaces } from "@/lib/workspace";
import { formatDateTime, timeAgo } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]">): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getProject(projectId);
  return { title: project?.name ?? "Project" };
}

export default function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <ProjectDetail params={params} />
    </Suspense>
  );
}

async function ProjectDetail({ params }: Pick<PageProps<"/projects/[projectId]">, "params">) {
  await requireUser();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [suites, cases, schedules, runs, workspaces] = await Promise.all([
    listSuites(project.id),
    listTestCases(project.id),
    listSchedules(project.id),
    listProjectRuns(project.id),
    listMyWorkspaces(),
  ]);
  // Deleting is admin-only (RLS enforces it); judge by the project's own workspace.
  const role = workspaces.find((w) => w.id === project.workspace_id)?.role;
  const canDelete = role === "owner" || role === "admin";
  const casesBySuite = new Map<string, TestCaseSummary[]>();
  for (const testCase of cases) {
    casesBySuite.set(testCase.suite_id, [...(casesBySuite.get(testCase.suite_id) ?? []), testCase]);
  }
  const suiteOptions = suites.map((s) => ({ id: s.id, name: s.name, caseCount: casesBySuite.get(s.id)?.length ?? 0 }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={project.name}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <EnvironmentBadge environment={project.environment} />
            <a
              href={project.base_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              {project.base_url} <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          </div>
        }
        actions={
          <>
            <RunTestsDialog projects={[{ id: project.id, name: project.name, suites: suiteOptions }]} />
            <Link href={`/projects/${project.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <PencilIcon /> Edit
            </Link>
            {canDelete && <DeleteProjectButton projectId={project.id} projectName={project.name} />}
          </>
        }
      />

      {project.description && <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Test suites</CardTitle>
          <CardDescription>Group related browser tests, such as &ldquo;Checkout&rdquo; or &ldquo;Login&rdquo;.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SuiteForm action={createSuite.bind(null, project.id)} />
          {suites.length === 0 ? (
            <EmptyState
              icon={LayersIcon}
              title="No test suites"
              description="Add a suite above to start organising tests for this project."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="text-right">Tests</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suites.map((suite) => (
                  <TableRow key={suite.id}>
                    <TableCell className="font-medium">{suite.name}</TableCell>
                    <TableCell className="hidden max-w-sm truncate text-muted-foreground sm:table-cell">
                      {suite.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{casesBySuite.get(suite.id)?.length ?? 0}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <time dateTime={suite.created_at} title={formatDateTime(suite.created_at)}>
                        {timeAgo(suite.created_at)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <DeleteSuiteButton projectId={project.id} suiteId={suite.id} suiteName={suite.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="test-cases">
        <CardHeader>
          <CardTitle>Test cases</CardTitle>
          <CardDescription>The browser steps each suite runs. Write them by hand or generate them with AI.</CardDescription>
          {suites.length > 0 && (
            <CardAction className="flex gap-2">
              <Link href="/generator" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <SparklesIcon /> Generate
              </Link>
              <Link href={`/projects/${project.id}/cases/new`} className={buttonVariants({ size: "sm" })}>
                <PlusIcon /> New test case
              </Link>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {suites.length === 0 ? (
            <EmptyState
              icon={FileCode2Icon}
              title="Add a suite first"
              description="Test cases belong to a suite. Create one above, then add test cases to it."
            />
          ) : cases.length === 0 ? (
            <EmptyState
              icon={FileCode2Icon}
              title="No test cases yet"
              description="Describe what a visitor does and what they should see, step by step."
              action={
                <Link href={`/projects/${project.id}/cases/new`} className={buttonVariants()}>
                  <PlusIcon /> New test case
                </Link>
              }
            />
          ) : (
            <div className="space-y-6">
              {suites.map((suite) => (
                <SuiteCases
                  key={suite.id}
                  projectId={project.id}
                  suite={suite}
                  cases={casesBySuite.get(suite.id) ?? []}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="schedules">
        <CardHeader>
          <CardTitle>Schedules</CardTitle>
          <CardDescription>Run tests automatically on a cron schedule.</CardDescription>
          <CardAction>
            <ScheduleDialog
              title="New schedule"
              trigger={
                <Button size="sm" variant="outline">
                  <PlusIcon /> New schedule
                </Button>
              }
              action={createSchedule.bind(null, project.id)}
              suites={suiteOptions}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClockIcon}
              title="No schedules"
              description="Add a schedule to run this project's tests every hour, every night, or on weekdays."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="hidden md:table-cell">Suite</TableHead>
                  <TableHead className="hidden sm:table-cell">Branch</TableHead>
                  <TableHead className="hidden lg:table-cell">Next run</TableHead>
                  <TableHead className="w-28">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {schedule.name}
                        {!schedule.enabled && <Badge variant="outline">Paused</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs">{schedule.cron}</code>
                      <span className="ml-2 text-xs text-muted-foreground">{schedule.timezone}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {schedule.suiteName ?? "All suites"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {schedule.branch}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {schedule.enabled && schedule.next_run_at ? (
                        <time dateTime={schedule.next_run_at} title={formatDateTime(schedule.next_run_at)}>
                          {timeAgo(schedule.next_run_at)}
                        </time>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <ScheduleRowActions projectId={project.id} schedule={schedule} suites={suiteOptions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>The latest test runs for this project.</CardDescription>
          {runs.length > 0 && (
            <CardAction>
              <Link href={`/runs?project=${project.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View all
              </Link>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="No runs yet"
              description="Click Run tests to queue a run. The DevPilot worker must be running to pick it up."
            />
          ) : (
            <RunsTable runs={runs} showProject={false} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SuiteCases({
  projectId,
  suite,
  cases,
}: {
  projectId: string;
  suite: { id: string; name: string };
  cases: TestCaseSummary[];
}) {
  return (
    <section aria-labelledby={`suite-${suite.id}`} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`suite-${suite.id}`} className="flex items-center gap-2 text-sm font-medium">
          <LayersIcon className="size-4 text-muted-foreground" aria-hidden /> {suite.name}
          <span className="text-muted-foreground tabular-nums">({cases.length})</span>
        </h3>
        <Link
          href={`/projects/${projectId}/cases/new?suite=${suite.id}`}
          className={buttonVariants({ variant: "ghost", size: "xs" })}
        >
          <PlusIcon /> Add
        </Link>
      </div>
      {cases.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">No test cases in this suite.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {cases.map((testCase) => (
            <li key={testCase.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <Link
                  href={`/projects/${projectId}/cases/${testCase.id}`}
                  className="flex items-center gap-2 truncate text-sm font-medium hover:underline"
                >
                  {testCase.name}
                  {testCase.source === "ai" && (
                    <Badge variant="secondary" className="gap-1">
                      <SparklesIcon aria-hidden /> AI
                    </Badge>
                  )}
                </Link>
                {testCase.description && (
                  <p className="truncate text-xs text-muted-foreground">{testCase.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {stepCount(testCase.steps)} {stepCount(testCase.steps) === 1 ? "step" : "steps"}
                </span>
                <time className="hidden sm:inline" dateTime={testCase.updated_at} title={formatDateTime(testCase.updated_at)}>
                  {timeAgo(testCase.updated_at)}
                </time>
                <DeleteTestCaseButton projectId={projectId} caseId={testCase.id} caseName={testCase.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading project">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
