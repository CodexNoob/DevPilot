import "server-only";
import { cookies } from "next/headers";
import { io } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Per-request Supabase client acting as the signed-in user, so every query
 * goes through Row Level Security. Create a new one per request; never share.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // The Supabase client reads Date.now() as soon as it's constructed (session
  // expiry checks). Mark everything after this point as request-time work so
  // Cache Components doesn't flag it during prerender validation.
  await io();
  const env = publicEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. Safe to ignore: the proxy
          // refreshes the session on every request before rendering.
        }
      },
    },
  });
}
