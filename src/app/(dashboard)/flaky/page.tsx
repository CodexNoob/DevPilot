import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listFlakyTests } from "@/features/flaky/queries";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Flaky tests" };

export default function FlakyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Flaky tests"
        description="Tests that both passed and failed in the last 30 days. Fix these first: they erode trust in every run."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" aria-busy="true" aria-label="Loading flaky tests" />}>
        <FlakyTable />
      </Suspense>
    </div>
  );
}

async function FlakyTable() {
  const { workspace } = await requireWorkspace();
  const tests = await listFlakyTests(workspace.id);

  if (tests.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title="No flaky tests"
        description="A test is flaky when it passes in some runs and fails in others without changes. None of your tests did that in the last 30 days."
      />
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Passed</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Failed</TableHead>
              <TableHead className="w-48">Failure rate</TableHead>
              <TableHead className="hidden md:table-cell">Last failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test) => (
              <TableRow key={`${test.projectId}:${test.testName}`}>
                <TableCell className="max-w-64 truncate font-medium">{test.testName}</TableCell>
                <TableCell className="max-w-48 truncate">
                  <Link href={`/projects/${test.projectId}`} className="hover:underline">
                    {test.projectName}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{test.totalRuns}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-emerald-700 sm:table-cell dark:text-emerald-400">
                  {test.passedRuns}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-red-700 sm:table-cell dark:text-red-400">
                  {test.failedRuns}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={test.failureRate}
                      aria-label={`Failure rate for ${test.testName}`}
                    >
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${Math.min(100, Math.max(0, test.failureRate))}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums">{test.failureRate.toFixed(1)}%</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {test.lastFailedAt ? (
                    <time dateTime={test.lastFailedAt} title={formatDateTime(test.lastFailedAt)}>
                      {timeAgo(test.lastFailedAt)}
                    </time>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
