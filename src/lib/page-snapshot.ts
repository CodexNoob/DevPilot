import { z } from "zod";

/**
 * What the worker records when it opens a page for the test generator.
 * Shared by the worker (which writes it) and the web app (which reads it and
 * passes it to Claude). Everything in here comes from the user's website and
 * is untrusted data.
 */

export const SNAPSHOT_LIMITS = {
  ariaChars: 15_000,
  fields: 80,
  fieldText: 120,
  title: 300,
  url: 2048,
} as const;

const text = (max: number) => z.string().max(max);

export const formFieldSchema = z.object({
  tag: z.enum(["input", "textarea", "select", "button"]),
  type: text(40).nullable(),
  name: text(SNAPSHOT_LIMITS.fieldText).nullable(),
  id: text(SNAPSHOT_LIMITS.fieldText).nullable(),
  label: text(SNAPSHOT_LIMITS.fieldText).nullable(),
  placeholder: text(SNAPSHOT_LIMITS.fieldText).nullable(),
  testId: text(SNAPSHOT_LIMITS.fieldText).nullable(),
});

export const pageSnapshotSchema = z.object({
  requestedUrl: text(SNAPSHOT_LIMITS.url),
  finalUrl: text(SNAPSHOT_LIMITS.url),
  httpStatus: z.number().int().nullable(),
  title: text(SNAPSHOT_LIMITS.title),
  /** Playwright aria snapshot (YAML) of the visible page, truncated. */
  aria: text(SNAPSHOT_LIMITS.ariaChars + 100),
  ariaTruncated: z.boolean(),
  fields: z.array(formFieldSchema).max(SNAPSHOT_LIMITS.fields),
});

export type PageSnapshot = z.infer<typeof pageSnapshotSchema>;
export type FormField = z.infer<typeof formFieldSchema>;

/** Path + query of a URL, e.g. "/login?next=/app". */
export function pathOf(url: URL): string {
  return `${url.pathname}${url.search}` || "/";
}
