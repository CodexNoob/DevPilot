import "server-only";
import { createClient } from "@/lib/supabase/server";

export type GenerationLimitResult = { allowed: true; retryAfterMs: 0 } | { allowed: false; retryAfterMs: number };

/**
 * Shared, atomic sliding-window limit enforced by Postgres. The user ID comes
 * from the function's verified auth context, never from client input.
 */
export async function takeGenerationLimit(): Promise<GenerationLimitResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("take_generation_rate_limit");
  if (error) throw new Error("Failed to check generation rate limit", { cause: error });

  const result = data[0];
  if (!result) throw new Error("Generation rate limit returned no result");
  return result.allowed
    ? { allowed: true, retryAfterMs: 0 }
    : { allowed: false, retryAfterMs: result.retry_after_ms };
}
