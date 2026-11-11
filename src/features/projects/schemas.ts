import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

export const PROJECT_ENVIRONMENTS = Constants.public.Enums.project_environment;

const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/,
  /\.localhost$/,
  /\.local$/,
  /\.internal$/,
  /^0\./,
  /^127\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^\[::ffff:/i, // IPv4-mapped IPv6 can smuggle any IPv4 address
  /^\[::\]$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local, incl. cloud metadata (169.254.169.254)
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i, // IPv6 unique-local
  /^\[?fe80:/i, // IPv6 link-local
];

export type BaseUrlResult = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Normalises and validates a project's base URL.
 *
 * - Adds `https://` if no scheme is given.
 * - Allows only http/https and rejects embedded credentials.
 * - Rejects loopback/private/link-local hosts. The hosted test worker would
 *   otherwise be pointed at its own network (SSRF). This is a first line of
 *   defence only: the worker must re-check resolved IPs at connection time.
 */
export function parseBaseUrl(input: string): BaseUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "URL is required" };
  if (trimmed.length > 2048) return { ok: false, reason: "URL is too long" };

  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "Enter a valid URL, e.g. https://example.com" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs are supported" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs must not contain credentials" };
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") && !host.startsWith("[")) {
    return { ok: false, reason: "Enter a public hostname, e.g. example.com" };
  }
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return { ok: false, reason: "Private and local network addresses can't be tested" };
  }

  url.hash = "";
  // Drop a lone trailing slash so "https://a.com" and "https://a.com/" are equal.
  const normalized = url.pathname === "/" && !url.search ? url.origin : url.toString();
  return { ok: true, url: normalized };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value === "" ? null : value));

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Must be 100 characters or fewer"),
  description: optionalText(1000),
  baseUrl: z.string().transform((value, ctx) => {
    const result = parseBaseUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.reason });
      return z.NEVER;
    }
    return result.url;
  }),
  environment: z.enum(PROJECT_ENVIRONMENTS, { error: "Choose an environment" }),
  /** Empty string from the "No client" option becomes null. */
  clientId: z
    .union([z.literal(""), z.uuid({ error: "Choose a client" })])
    .optional()
    .transform((value) => value || null),
});

export type ProjectInput = z.output<typeof projectInputSchema>;
export const PROJECT_FORM_FIELDS = ["name", "description", "baseUrl", "environment", "clientId"] as const;

export const suiteInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Must be 100 characters or fewer"),
  description: optionalText(1000),
});

export type SuiteInput = z.output<typeof suiteInputSchema>;
export const SUITE_FORM_FIELDS = ["name", "description"] as const;

export const idSchema = z.uuid();
