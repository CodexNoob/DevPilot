/** Route prefixes that require a signed-in user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/settings",
  "/runs",
  "/flaky",
  "/generator",
  "/clients",
  "/users",
  "/workspaces",
] as const;

/** Pages that only make sense when signed out. */
const AUTH_PAGES = ["/login", "/signup"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PAGES.some((page) => matchesPrefix(pathname, page));
}

/**
 * Sanitises a post-login redirect target. Only same-origin, absolute paths
 * are allowed, which prevents open redirects such as `?next=//evil.com`
 * or `?next=https://evil.com`.
 */
export function safeRedirectPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
