import { z } from "zod";
import { Constants, type Enums } from "@/lib/supabase/database.types";

export type RunStatus = Enums<"test_run_status">;
export const RUN_STATUSES = Constants.public.Enums.test_run_status;
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ["queued", "running"];

export const RUNS_PAGE_SIZE = 50;

export const RUN_FORM_FIELDS = ["projectId", "suiteId", "branch"] as const;

/** "850ms", "42s", "1.1m", "1.5h". Null/negative → "—". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${trim(minutes)}m`;
  return `${trim(minutes / 60)}h`;
}

const trim = (n: number) => (Math.round(n * 10) / 10).toString();

export type RunFilters = { projectId: string | null; status: RunStatus | null; page: number };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Parses /runs search params. Invalid values are ignored rather than erroring. */
export function parseRunFilters(params: SearchParams): RunFilters {
  const project = first(params.project);
  const status = first(params.status);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    projectId: project && z.uuid().safeParse(project).success ? project : null,
    status: status && (RUN_STATUSES as readonly string[]).includes(status) ? (status as RunStatus) : null,
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10_000) : 1,
  };
}

/** Builds a /runs URL keeping the other filters. */
export function runsHref(filters: Partial<RunFilters>): string {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `/runs?${query}` : "/runs";
}

export const branchSchema = z
  .string()
  .trim()
  .min(1, "Branch is required")
  .max(100, "Must be 100 characters or fewer")
  .regex(/^[A-Za-z0-9._/-]+$/, "Use letters, numbers, dots, dashes, underscores and slashes");
