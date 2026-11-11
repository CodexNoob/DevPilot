import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, BugIcon, ImageIcon, ListChecksIcon } from "lucide-react";
import { countPageErrors, PAGE_ERROR_LABELS, type PageError } from "@/lib/page-errors";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ResultStatusBadge, RunStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CancelRunButton, RerunButton } from "@/features/runs/components/run-actions";
import { RunAutoRefresh } from "@/features/runs/components/run-auto-refresh";
import { ACTIVE_RUN_STATUSES, formatDuration } from "@/features/runs/format";
import { getRun, listRunResults, type RunDetail, type RunResult } from "@/features/runs/queries";
import { requireUser } from "@/lib/auth";
import { formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Test run" };

export default function RunPage({ params }: PageProps<"/runs/[runId]">) {
  return (
    <Suspense fallback={<RunSkeleton />}>
      <Run params={params} />
    </Suspense>
  );
}

async function Run({ params }: Pick<PageProps<"/runs/[runId]">, "params">) {
  await requireUser();
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();
  const results = await listRunResults(run.id);
  const active = ACTIVE_RUN_STATUSES.includes(run.status);
  const pageErrorTotal = results.reduce((total, r) => total + countPageErrors(r.pageErrors), 0);

  return (
    <div className="space-y-8">
      <RunAutoRefresh active={active} />
      <Link href="/runs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All runs
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Run #{run.number} <RunStatusBadge status={run.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/projects/${run.project_id}`} className="font-medium text-foreground hover:underline">
              {run.projectName}
            </Link>
            <span aria-hidden>·</span>
            {run.suiteName ?? "All suites"}
            <span aria-hidden>·</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {run.branch}
            </Badge>
          </span>
        }
        actions={
          <>
            {run.status === "queued" && <CancelRunButton runId={run.id} />}
            {!active && <RerunButton runId={run.id} />}
          </>
        }
      />

      <RunSummary run={run} pageErrorCount={pageErrorTotal} />

      {pageErrorTotal > 0 && (
        <Alert>
          <BugIcon />
          <AlertTitle>
            DevPilot detected {pageErrorTotal} page {pageErrorTotal === 1 ? "error" : "errors"} while testing
          </AlertTitle>
          <AlertDescription>
            These happened on the site itself (JavaScript errors, failed requests, HTTP 4xx/5xx responses), whether or not
            a test step checked for them. They are listed under each test below.
          </AlertDescription>
        </Alert>
      )}

      {run.error_message && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>The run could not complete</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{run.error_message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Failures are listed first.</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <EmptyState
              icon={ListChecksIcon}
              title={active ? "Waiting for results" : "No results"}
              description={
                run.status === "queued"
                  ? "This run is queued. Results appear here once the DevPilot worker picks it up. If it stays queued, make sure the worker is running."
                  : run.status === "running"
                    ? "Tests are running. This page refreshes automatically."
                    : "This run finished without recording any test results."
              }
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {results.map((result) => (
                <ResultRow key={result.id} result={result} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RunSummary({ run, pageErrorCount }: { run: RunDetail; pageErrorCount: number }) {
  const items: [label: string, value: React.ReactNode][] = [
    ["Passed", <span key="p" className="text-emerald-700 dark:text-emerald-400">{run.passed_count}</span>],
    ["Failed", <span key="f" className="text-red-700 dark:text-red-400">{run.failed_count}</span>],
    [
      "Page errors",
      <span key="e" className={pageErrorCount > 0 ? "text-amber-700 dark:text-amber-400" : undefined}>
        {pageErrorCount}
      </span>,
    ],
    ["Skipped", run.skipped_count],
    ["Total", run.total_count],
    ["Duration", formatDuration(run.duration_ms)],
    ["Trigger", <span key="t" className="capitalize">{run.trigger}</span>],
    ["By", run.triggeredBy ?? "—"],
    [
      "Queued",
      <time key="q" dateTime={run.created_at} title={formatDateTime(run.created_at)}>
        {timeAgo(run.created_at)}
      </time>,
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3 lg:grid-cols-9">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResultRow({ result }: { result: RunResult }) {
  const errorCount = countPageErrors(result.pageErrors);
  const hasDetails = Boolean(result.error_message || result.logs || result.screenshot_path || errorCount);
  const summary = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2">
        <ResultStatusBadge status={result.status} />
        <span className="truncate text-sm font-medium">{result.test_name}</span>
        {errorCount > 0 && (
          <Badge variant="secondary" className="shrink-0 gap-1 border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300">
            <BugIcon className="size-3" aria-hidden />
            {errorCount} page {errorCount === 1 ? "error" : "errors"}
          </Badge>
        )}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDuration(result.duration_ms)}</span>
    </div>
  );

  if (!hasDetails) return <li className="px-3 py-2.5">{summary}</li>;

  return (
    <li>
      <details open={result.status === "failed" || result.status === "timed_out" || errorCount > 0} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          {summary}
        </summary>
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
          {result.error_message && (
            <pre className="overflow-x-auto rounded-md bg-red-500/10 p-3 text-xs whitespace-pre-wrap text-red-800 dark:text-red-300">
              {result.error_message}
            </pre>
          )}
          {errorCount > 0 && <PageErrorList errors={result.pageErrors} />}
          {result.screenshot_path &&
            (result.screenshotUrl ? (
              <a href={result.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                {/* Signed, short-lived URL from private storage; next/image would need remotePatterns. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.screenshotUrl}
                  alt={`Screenshot when "${result.test_name}" ${result.status === "passed" ? "finished" : "failed"}`}
                  className="max-h-72 rounded-md border"
                  loading="lazy"
                />
              </a>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="size-3.5" aria-hidden /> Screenshot unavailable.
              </p>
            ))}
          {result.logs && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Logs</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                {result.logs}
              </pre>
            </details>
          )}
        </div>
      </details>
    </li>
  );
}

function PageErrorList({ errors }: { errors: PageError[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Errors detected on the page</p>
      <ul className="divide-y rounded-md border bg-background text-xs">
        {errors.map((error, i) => (
          <li key={i} className="grid gap-0.5 px-3 py-2">
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                {PAGE_ERROR_LABELS[error.kind]}
              </Badge>
              <span className="font-medium break-all">{error.message}</span>
              {error.count > 1 && <span className="text-muted-foreground">×{error.count}</span>}
            </span>
            {error.url && <span className="font-mono break-all text-muted-foreground">{error.url}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading run">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
