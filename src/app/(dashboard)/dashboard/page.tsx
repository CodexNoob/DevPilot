import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  ActivityIcon,
  CalendarClockIcon,
  EyeIcon,
  FolderKanbanIcon,
  GaugeIcon,
  InboxIcon,
  LoaderIcon,
  PlayIcon,
  PlusIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RunStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkline, type SparklineTone } from "@/features/dashboard/components/sparkline";
import {
  dailyPassRates,
  formatDuration,
  passRateTrend,
  sumDays,
  weightedAverageDuration,
} from "@/features/dashboard/metrics";
import { getDashboardData, METRICS_WINDOW_DAYS, type RecentRun } from "@/features/dashboard/queries";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Testing activity across this workspace."
        actions={
          <>
            <Link href="/runs" className={buttonVariants({ variant: "outline" })}>
              <PlayIcon /> Run tests
            </Link>
            <Link href="/projects/new" className={buttonVariants()}>
              <PlusIcon /> New project
            </Link>
          </>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const { workspace } = await requireWorkspace();
  const data = await getDashboardData(workspace.id);

  if (data.projectCount === 0) {
    return (
      <EmptyState
        icon={FolderKanbanIcon}
        title="Create your first project"
        description="A project is a website you want DevPilot to test. Add its URL to get started."
        action={
          <Link href="/projects/new" className={buttonVariants()}>
            <PlusIcon /> New project
          </Link>
        }
      />
    );
  }

  const totals = sumDays(data.days);
  const trend = passRateTrend(data.days);
  const passTone: SparklineTone = trend === "down" ? "negative" : "positive";
  const avgDuration = weightedAverageDuration(data.days, 7);

  return (
    <>
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={GaugeIcon}
          label={`Pass rate (${METRICS_WINDOW_DAYS}d)`}
          value={totals.passRate === null ? "—" : `${totals.passRate}%`}
          hint={
            totals.passed + totals.failed === 0
              ? "No completed runs yet"
              : `${totals.passed} passing / ${totals.failed} failing`
          }
          chart={
            <Sparkline
              values={dailyPassRates(data.days)}
              domain={[0, 100]}
              tone={passTone}
              label={`Daily pass rate over the last ${METRICS_WINDOW_DAYS} days, trending ${trend} week over week`}
            />
          }
        />
        <StatCard
          icon={ActivityIcon}
          label={`Total runs (${METRICS_WINDOW_DAYS}d)`}
          value={totals.total.toLocaleString("en")}
          hint="Test executions this month"
          chart={
            <Sparkline
              values={data.days.map((d) => d.total)}
              label={`Daily run count over the last ${METRICS_WINDOW_DAYS} days, ${totals.total} in total`}
            />
          }
        />
        <StatCard
          icon={TimerIcon}
          label="Avg duration (7d)"
          value={formatDuration(avgDuration)}
          hint="Average test run time"
        />
        <StatCard
          icon={LoaderIcon}
          label="Running now"
          value={data.runningCount.toString()}
          hint="Jobs actively executing"
          accent={data.runningCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
        <StatCard
          icon={InboxIcon}
          label="Queued"
          value={data.queuedCount.toString()}
          hint={data.queuedCount === 0 ? "Queue is empty" : "Waiting for a worker"}
        />
        <StatCard
          icon={CalendarClockIcon}
          label="Scheduled today"
          value={data.scheduledToday.toString()}
          hint="Cron runs due before midnight (UTC)"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent test runs</CardTitle>
          <CardDescription>The latest runs across every project in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentRuns.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="No test runs yet"
              description="Queue a run from the Test Runs page, or add a schedule to a project."
              action={
                <Link href="/runs" className={buttonVariants({ variant: "outline" })}>
                  <PlayIcon /> Run tests
                </Link>
              }
            />
          ) : (
            <RecentRunsTable runs={data.recentRuns} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function RecentRunsTable({ runs }: { runs: RecentRun[] }) {
  return (
    <Table className="min-w-4xl">
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Suite</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Passed</span>
            <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
              ✓
            </span>
          </TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Failed</span>
            <span aria-hidden className="text-red-600 dark:text-red-400">
              ✕
            </span>
          </TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>By</TableHead>
          <TableHead>When</TableHead>
          <TableHead className="w-16">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell className="tabular-nums text-muted-foreground">{run.number}</TableCell>
            <TableCell>
              {run.clientName ? (
                <Badge variant="outline" className="max-w-32 truncate">
                  {run.clientName}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-48 truncate font-medium">
              <Link href={`/projects/${run.projectId}`} className="hover:underline">
                {run.projectName}
              </Link>
            </TableCell>
            <TableCell className="max-w-40 truncate text-muted-foreground">{run.suiteName ?? "All suites"}</TableCell>
            <TableCell>
              <RunStatusBadge status={run.status} />
            </TableCell>
            <Count value={run.passed} className="text-emerald-600 dark:text-emerald-400" />
            <Count value={run.failed} className="text-red-600 dark:text-red-400" />
            <Count value={run.total} />
            <TableCell>
              <Badge variant="secondary" className="max-w-28 truncate font-mono">
                {run.branch}
              </Badge>
            </TableCell>
            <TableCell className="max-w-36 truncate text-muted-foreground">
              {run.trigger === "scheduled" ? "Schedule" : (run.triggeredBy ?? "—")}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              <time dateTime={run.createdAt} title={formatDateTime(run.createdAt)}>
                {timeAgo(run.createdAt)}
              </time>
            </TableCell>
            <TableCell>
              <Link
                href={`/runs/${run.id}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                aria-label={`View run ${run.number} of ${run.projectName}`}
              >
                <EyeIcon /> View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Count({ value, className }: { value: number; className?: string }) {
  return (
    <TableCell className={cn("text-right tabular-nums", value === 0 ? "text-muted-foreground" : className)}>
      {value}
    </TableCell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  chart,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  chart?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className={cn("justify-between", chart && "pb-0")}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden /> {label}
        </CardDescription>
        <CardTitle className={cn("text-3xl font-semibold tabular-nums", accent)}>{value}</CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      {chart && <div className="-mt-1">{chart}</div>}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
