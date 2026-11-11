import { z } from "zod";

/**
 * Errors a page produced while a test ran, detected automatically by the
 * worker. Shared by the worker (collects) and the web app (displays).
 */

export const PAGE_ERROR_KINDS = ["page-error", "console-error", "http-error", "request-failed"] as const;
export type PageErrorKind = (typeof PAGE_ERROR_KINDS)[number];

export const PAGE_ERROR_LABELS: Record<PageErrorKind, string> = {
  "page-error": "JavaScript error",
  "console-error": "Console error",
  "http-error": "HTTP error",
  "request-failed": "Request failed",
};

export const MAX_PAGE_ERRORS = 50;
const MAX_MESSAGE = 500;
const MAX_URL = 500;

export const pageErrorSchema = z.object({
  kind: z.enum(PAGE_ERROR_KINDS),
  message: z.string().max(MAX_MESSAGE),
  url: z.string().max(MAX_URL).nullable(),
  status: z.number().int().nullable(),
  count: z.number().int().min(1),
});

export type PageError = z.infer<typeof pageErrorSchema>;

/** Parses stored page errors, dropping anything malformed instead of throwing. */
export function parsePageErrors(value: unknown): PageError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = pageErrorSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Groups identical errors (same kind, message and URL) and counts repeats, so
 * a page that logs the same error 200 times yields one entry with count 200.
 */
export function createPageErrorCollector(limit = MAX_PAGE_ERRORS) {
  const entries = new Map<string, PageError>();
  let dropped = 0;

  return {
    add(kind: PageErrorKind, message: string, url: string | null = null, status: number | null = null) {
      const cleanMessage = message.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE) || "(no message)";
      const cleanUrl = url ? url.slice(0, MAX_URL) : null;
      const key = `${kind}\u0000${cleanMessage}\u0000${cleanUrl ?? ""}`;
      const existing = entries.get(key);
      if (existing) {
        existing.count++;
        return;
      }
      if (entries.size >= limit) {
        dropped++;
        return;
      }
      entries.set(key, { kind, message: cleanMessage, url: cleanUrl, status, count: 1 });
    },
    /** Grouped errors, most frequent first. */
    list(): PageError[] {
      return [...entries.values()].sort((a, b) => b.count - a.count);
    },
    /** Distinct errors not recorded because the limit was reached. */
    get dropped() {
      return dropped;
    },
  };
}

/** Total occurrences across grouped errors. */
export function countPageErrors(errors: readonly PageError[]): number {
  return errors.reduce((total, e) => total + e.count, 0);
}
