import Link from "next/link";
import { EyeIcon } from "lucide-react";
import { RunStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, timeAgo } from "@/lib/format";
import { formatDuration } from "../format";
import type { RunListItem } from "../queries";

/** Runs table shared by /runs and the project page. */
export function RunsTable({ runs, showProject = true }: { runs: RunListItem[]; showProject?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          {showProject && <TableHead className="hidden lg:table-cell">Client</TableHead>}
          {showProject && <TableHead>Project</TableHead>}
          <TableHead className="hidden md:table-cell">Suite</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right tabular-nums" title="Passed">
            <span className="sr-only">Passed</span>
            <span aria-hidden className="text-emerald-600 dark:text-emerald-400">✓</span>
          </TableHead>
          <TableHead className="text-right tabular-nums" title="Failed">
            <span className="sr-only">Failed</span>
            <span aria-hidden className="text-red-600 dark:text-red-400">✕</span>
          </TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="hidden sm:table-cell">Branch</TableHead>
          <TableHead className="hidden xl:table-cell">By</TableHead>
          <TableHead className="hidden sm:table-cell">When</TableHead>
          <TableHead className="hidden md:table-cell text-right">Duration</TableHead>
          <TableHead className="w-16">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell className="tabular-nums text-muted-foreground">{run.number}</TableCell>
            {showProject && (
              <TableCell className="hidden lg:table-cell">
                {run.clientName ? (
                  <Badge variant="outline" className="max-w-32 truncate">
                    {run.clientName}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            )}
            {showProject && (
              <TableCell className="max-w-48 truncate font-medium">
                <Link href={`/projects/${run.projectId}`} className="hover:underline">
                  {run.projectName}
                </Link>
              </TableCell>
            )}
            <TableCell className="hidden max-w-40 truncate md:table-cell">
              {run.suiteName ?? <span className="text-muted-foreground">All suites</span>}
            </TableCell>
            <TableCell>
              <RunStatusBadge status={run.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{run.passed}</TableCell>
            <TableCell className="text-right tabular-nums text-red-700 dark:text-red-400">{run.failed}</TableCell>
            <TableCell className="text-right tabular-nums">{run.total}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <Badge variant="secondary" className="max-w-32 truncate font-mono text-xs">
                {run.branch}
              </Badge>
            </TableCell>
            <TableCell className="hidden max-w-36 truncate text-muted-foreground xl:table-cell">
              {run.triggeredBy ?? "—"}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
              <time dateTime={run.createdAt} title={formatDateTime(run.createdAt)}>
                {timeAgo(run.createdAt)}
              </time>
            </TableCell>
            <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
              {formatDuration(run.durationMs)}
            </TableCell>
            <TableCell>
              <Link
                href={`/runs/${run.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                aria-label={`View run #${run.number}`}
              >
                <EyeIcon className="size-3.5" aria-hidden /> View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
