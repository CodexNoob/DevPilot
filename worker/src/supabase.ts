import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import type { WorkerEnv } from "./env";

export type WorkerClient = SupabaseClient<Database>;

/**
 * Service-role client: bypasses RLS. Only the worker holds this key; it must
 * never reach the web app or a browser.
 */
export function createWorkerClient(env: WorkerEnv): WorkerClient {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
