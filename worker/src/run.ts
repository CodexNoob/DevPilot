import { randomUUID } from "node:crypto";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { hasAssertion, NO_ASSERTION_MESSAGE, testStepsSchema } from "../../src/lib/test-steps";
import { countPageErrors, createPageErrorCollector } from "../../src/lib/page-errors";
import type { Enums, Json, Tables, TablesUpdate } from "../../src/lib/supabase/database.types";
import type { WorkerEnv } from "./env";
import { executeSteps } from "./executor";
import { errorMessage, log, truncate } from "./log";
import { createNetworkGuard, type NetworkGuard } from "./network-guard";
import type { WorkerClient } from "./supabase";

type Run = Tables<"test_runs">;
type TestCase = Pick<Tables<"test_cases">, "id" | "name" | "steps" | "suite_id">;
type ResultStatus = Enums<"test_result_status">;

const MAX_LOG_CHARS = 20_000;
const MAX_ERROR_CHARS = 5_000;
const SCREENSHOT_BUCKET = "screenshots";

type CaseResult = { status: ResultStatus };

async function loadRunInputs(db: WorkerClient, run: Run) {
  const project = await db.from("projects").select("id, base_url").eq("id", run.project_id).single();
  if (project.error) throw new Error(`Project not found: ${project.error.message}`);

  let query = db
    .from("test_cases")
    .select("id, name, steps, suite_id, test_suites(name)")
    .eq("project_id", run.project_id);
  if (run.suite_id) query = query.eq("suite_id", run.suite_id);
  const cases = await query;
  if (cases.error) throw new Error(`Failed to load test cases: ${cases.error.message}`);

  const sorted = [...cases.data].sort(
    (a, b) =>
      (a.test_suites?.name ?? "").localeCompare(b.test_suites?.name ?? "") || a.name.localeCompare(b.name),
  );
  return { baseUrl: project.data.base_url, cases: sorted as TestCase[] };
}

/** Routes every request of the context through the SSRF guard. */
export async function guardContext(context: BrowserContext, guard: NetworkGuard, logLine: (line: string) => void) {
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    const verdict = await guard.check(url);
    if (verdict.allowed) return route.continue();
    logLine(`⛔ Blocked request ${url.slice(0, 200)}: ${verdict.reason}`);
    return route.abort("blockedbyclient");
  });
}

async function runTestCase(
  db: WorkerClient,
  env: WorkerEnv,
  browser: Browser,
  guard: NetworkGuard,
  run: Run,
  baseUrl: string,
  testCase: TestCase,
): Promise<CaseResult> {
  const resultId = randomUUID();
  const lines: string[] = [];
  const logLine = (line: string) => lines.push(`[${new Date().toISOString()}] ${line}`);
  const started = Date.now();

  let status: ResultStatus = "passed";
  let error: string | null = null;
  let screenshotPath: string | null = null;
  const pageErrors = createPageErrorCollector();

  const steps = testStepsSchema.safeParse(testCase.steps);
  if (!steps.success) {
    status = "failed";
    error = `Invalid test steps: ${steps.error.issues[0]?.message ?? "unknown error"}`;
    logLine(error);
  } else if (!hasAssertion(steps.data)) {
    // Without an expect-* step a test can only pass, which would report a false success.
    status = "failed";
    error = `This test checks nothing. ${NO_ASSERTION_MESSAGE}.`;
    logLine(error);
  } else {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: false });
    try {
      await guardContext(context, guard, logLine);
      const page = await context.newPage();
      page.setDefaultTimeout(env.WORKER_STEP_TIMEOUT_MS);
      // Detect every error the page produces, whether or not the steps check for it.
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        logLine(`console.error: ${text.slice(0, 500)}`);
        // Chrome logs "Failed to load resource" for every 4xx/5xx; the response handler records those with their URL.
        if (!text.startsWith("Failed to load resource:")) pageErrors.add("console-error", text, msg.location().url || null);
      });
      page.on("pageerror", (err) => {
        logLine(`page error: ${err.message.slice(0, 500)}`);
        pageErrors.add("page-error", err.message);
      });
      page.on("response", (response) => {
        const code = response.status();
        if (code < 400) return;
        logLine(`HTTP ${code}: ${response.url().slice(0, 200)}`);
        pageErrors.add("http-error", `HTTP ${code}${response.statusText() ? ` ${response.statusText()}` : ""}`, response.url(), code);
      });
      page.on("requestfailed", (req) => {
        const failure = req.failure()?.errorText ?? "failed";
        // Blocked by our SSRF guard (logged separately) or cancelled by a navigation: not page bugs.
        if (failure === "net::ERR_BLOCKED_BY_CLIENT" || failure === "net::ERR_ABORTED") return;
        logLine(`request failed: ${req.url().slice(0, 200)} (${failure})`);
        pageErrors.add("request-failed", failure, req.url());
      });

      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), env.WORKER_TEST_TIMEOUT_MS);
      });
      const outcome = await Promise.race([
        executeSteps(page, steps.data, { baseUrl, stepTimeoutMs: env.WORKER_STEP_TIMEOUT_MS, log: logLine }),
        timeout,
      ]);
      clearTimeout(timer);

      // Let late requests and scripts finish so errors they raise are detected too.
      if (outcome !== "timeout") await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);

      if (outcome === "timeout") {
        status = "timed_out";
        error = `Test exceeded ${Math.round(env.WORKER_TEST_TIMEOUT_MS / 1000)} s`;
        logLine(error);
      } else if (!outcome.ok) {
        status = "failed";
        error = outcome.error;
      }

      if (status !== "passed") {
        try {
          const png = await page.screenshot({ type: "png", fullPage: false, timeout: 10_000 });
          const path = `${run.project_id}/${run.id}/${resultId}.png`;
          const upload = await db.storage.from(SCREENSHOT_BUCKET).upload(path, png, { contentType: "image/png" });
          if (upload.error) throw upload.error;
          screenshotPath = path;
        } catch (screenshotError) {
          log("warn", "Screenshot failed", { run: run.number, test: testCase.name, error: errorMessage(screenshotError) });
        }
      }
    } catch (unexpected) {
      status = "failed";
      error = errorMessage(unexpected);
      logLine(`Unexpected error: ${error}`);
    } finally {
      // Closing the context also aborts anything still pending after a timeout.
      await context.close().catch(() => undefined);
    }
  }

  const detected = pageErrors.list();
  if (detected.length) {
    const more = pageErrors.dropped ? ` (+${pageErrors.dropped} more not recorded)` : "";
    logLine(`Detected ${countPageErrors(detected)} page error(s) in ${detected.length} group(s)${more}`);
  }

  const result = {
    id: resultId,
    run_id: run.id,
    project_id: run.project_id,
    test_case_id: testCase.id,
    test_name: testCase.name,
    status,
    duration_ms: Date.now() - started,
    error_message: error ? truncate(error, MAX_ERROR_CHARS) : null,
    logs: truncate(lines.join("\n"), MAX_LOG_CHARS),
    screenshot_path: screenshotPath,
    page_errors: detected as unknown as Json,
  };
  let insert = await db.from("test_results").insert(result);
  if (insert.error?.message.includes("page_errors")) {
    // The page_errors migration isn't applied: keep the result (error, logs, screenshot) rather than lose it.
    log("warn", "Saving result without page errors: apply supabase/migrations/20261111000100_test_result_page_errors.sql", {
      run: run.number,
    });
    const { page_errors: _omitted, ...withoutPageErrors } = result;
    insert = await db.from("test_results").insert(withoutPageErrors);
  }
  if (insert.error) log("error", "Failed to save result", { run: run.number, test: testCase.name, error: insert.error.message });

  log(status === "passed" ? "info" : "warn", `Test ${status}`, { run: run.number, test: testCase.name });
  return { status };
}

/** Marks the run finished unless it was cancelled meanwhile. */
async function finishRun(db: WorkerClient, run: Run, update: TablesUpdate<"test_runs">) {
  const { error } = await db
    .from("test_runs")
    .update({ ...update, finished_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("status", "running");
  if (error) log("error", "Failed to update run", { run: run.number, error: error.message });
}

/** Executes a claimed run end to end. Never throws. */
export async function executeRun(db: WorkerClient, env: WorkerEnv, run: Run): Promise<void> {
  log("info", "Run started", { run: run.number, id: run.id, project: run.project_id });
  let browser: Browser | undefined;
  try {
    const { baseUrl, cases } = await loadRunInputs(db, run);
    if (cases.length === 0) {
      await finishRun(db, run, { status: "error", error_message: "No test cases to run" });
      log("warn", "Run has no test cases", { run: run.number });
      return;
    }

    const guard = createNetworkGuard();
    const entry = await guard.check(baseUrl);
    if (!entry.allowed) {
      await finishRun(db, run, { status: "error", error_message: `Project URL is not allowed: ${entry.reason}` });
      return;
    }

    browser = await chromium.launch({ headless: true });
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const testCase of cases) {
      const current = await db.from("test_runs").select("status").eq("id", run.id).single();
      if (current.data?.status !== "running") {
        log("info", "Run no longer running; stopping", { run: run.number, status: current.data?.status });
        counts.skipped += cases.length - counts.passed - counts.failed;
        break;
      }
      const { status } = await runTestCase(db, env, browser, guard, run, baseUrl, testCase);
      if (status === "passed") counts.passed++;
      else if (status === "skipped") counts.skipped++;
      else counts.failed++;
    }

    await finishRun(db, run, {
      status: counts.failed > 0 ? "failed" : "passed",
      passed_count: counts.passed,
      failed_count: counts.failed,
      skipped_count: counts.skipped,
      total_count: cases.length,
    });
    log("info", "Run finished", { run: run.number, ...counts, total: cases.length });
  } catch (error) {
    const message = errorMessage(error);
    log("error", "Run errored", { run: run.number, error: message });
    await finishRun(db, run, { status: "error", error_message: truncate(message, MAX_ERROR_CHARS) });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/** Marks runs stuck in "running" (e.g. after a crash) as errored. */
export async function recoverAbandonedRuns(db: WorkerClient, staleMinutes: number): Promise<void> {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data, error } = await db
    .from("test_runs")
    .update({ status: "error", error_message: "Worker restarted", finished_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("number");
  if (error) log("error", "Failed to recover abandoned runs", { error: error.message });
  else if (data.length) log("warn", "Marked abandoned runs as errored", { count: data.length });
}
