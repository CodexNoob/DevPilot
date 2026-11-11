import { existsSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SECRET_KEY: z.string().min(1),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(5000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(1),
  WORKER_STEP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  WORKER_TEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(30 * 60_000).default(120_000),
  /** Runs left in "running" longer than this are considered abandoned on startup. */
  WORKER_STALE_RUN_MINUTES: z.coerce.number().int().min(5).default(60),
});

export type WorkerEnv = z.infer<typeof envSchema>;

/** Loads worker/.env (if present) and validates the environment. Exits on error. */
export function loadEnv(envFile = "worker/.env"): WorkerEnv {
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`[worker] Invalid or missing environment variables:\n${problems}\nSee worker/.env.example.`);
    process.exit(1);
  }
  return parsed.data;
}
