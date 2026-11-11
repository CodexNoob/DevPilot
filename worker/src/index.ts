import { loadEnv } from "./env";
import { errorMessage, log } from "./log";
import { executeRun, recoverAbandonedRuns } from "./run";
import { schedulerTick } from "./scheduler";
import { executeSnapshot } from "./snapshot";
import { createWorkerClient } from "./supabase";

/**
 * DevPilot test worker: enqueues scheduled runs and executes queued runs with
 * Playwright. Runs anywhere Node 22 and Chromium are available; it talks to
 * Supabase with the service-role key and never exposes an HTTP endpoint.
 */
const env = loadEnv();
const db = createWorkerClient(env);

let stopping = false;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sleeps in short slices so shutdown isn't delayed by a long poll interval. */
async function idle(ms: number) {
  const until = Date.now() + ms;
  while (!stopping && Date.now() < until) await sleep(Math.min(250, until - Date.now()));
}

async function schedulerLoop() {
  while (!stopping) {
    try {
      await schedulerTick(db);
    } catch (error) {
      log("error", "Scheduler tick failed", { error: errorMessage(error) });
    }
    await idle(Math.max(env.WORKER_POLL_INTERVAL_MS, 15_000));
  }
}

async function runLoop(slot: number) {
  while (!stopping) {
    try {
      const claimed = await db.rpc("claim_next_run");
      if (claimed.error) throw claimed.error;
      const run = claimed.data[0];
      if (run) {
        await executeRun(db, env, run);
        continue; // look for more work immediately
      }
    } catch (error) {
      log("error", "Polling failed", { slot, error: errorMessage(error) });
    }
    await idle(env.WORKER_POLL_INTERVAL_MS);
  }
}

/**
 * Page captures for the test generator. A separate loop with a short poll so
 * someone waiting on "Generate tests" isn't stuck behind a long test run.
 */
const SNAPSHOT_POLL_MS = 1000;

async function snapshotLoop() {
  while (!stopping) {
    try {
      const claimed = await db.rpc("claim_next_page_snapshot");
      if (claimed.error) throw claimed.error;
      const job = claimed.data[0];
      if (job) {
        await executeSnapshot(db, env, job);
        continue;
      }
    } catch (error) {
      // E.g. the page_snapshots migration isn't applied yet: back off instead of logging every second.
      log("error", "Snapshot polling failed", { error: errorMessage(error) });
      await idle(30_000);
      continue;
    }
    await idle(SNAPSHOT_POLL_MS);
  }
}

function shutdown(signal: string) {
  if (stopping) {
    log("warn", "Forced exit");
    process.exit(1);
  }
  stopping = true;
  log("info", `${signal} received; finishing current runs (send again to force)`);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main() {
  log("info", "Worker starting", { concurrency: env.WORKER_CONCURRENCY, pollMs: env.WORKER_POLL_INTERVAL_MS });
  await recoverAbandonedRuns(db, env.WORKER_STALE_RUN_MINUTES);
  await Promise.all([
    schedulerLoop(),
    snapshotLoop(),
    ...Array.from({ length: env.WORKER_CONCURRENCY }, (_, i) => runLoop(i + 1)),
  ]);
  log("info", "Worker stopped");
}

main().catch((error) => {
  log("error", "Worker crashed", { error: errorMessage(error) });
  process.exit(1);
});
