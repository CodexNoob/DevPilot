import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { isProtectedPath, isAuthPath } from "@/lib/routes";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session cookie on every request and performs an
 * *optimistic* redirect for unauthenticated users. This is a UX convenience,
 * not the security boundary: pages re-check the user via the data access
 * layer, and the database enforces RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Do not run code between client creation and getClaims(): it is what
  // validates and refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isSignedIn && isProtectedPath(pathname)) {
    return redirectPreservingCookies(request, response, "/login", pathname);
  }
  if (isSignedIn && isAuthPath(pathname)) {
    return redirectPreservingCookies(request, response, "/dashboard");
  }

  return response;
}

function redirectPreservingCookies(
  request: NextRequest,
  from: NextResponse,
  to: string,
  next?: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  const redirect = NextResponse.redirect(url);
  // Carry over refreshed session cookies so the browser stays in sync.
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
