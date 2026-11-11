import { chromium, type Browser, type Page } from "playwright";
import { pageSnapshotSchema, SNAPSHOT_LIMITS, type FormField, type PageSnapshot } from "../../src/lib/page-snapshot";
import type { Json, Tables } from "../../src/lib/supabase/database.types";
import type { WorkerEnv } from "./env";
import { errorMessage, log, truncate } from "./log";
import { createNetworkGuard, resolveGotoUrl } from "./network-guard";
import { guardContext } from "./run";
import type { WorkerClient } from "./supabase";

type SnapshotJob = Tables<"page_snapshots">;

/** Whole capture budget: navigation, settling and reading the page. */
const CAPTURE_TIMEOUT_MS = 45_000;
const SETTLE_MS = 5_000;

const clip = (value: string | null | undefined, max: number): string | null => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/** Visible form controls with the attributes stable selectors are built from. Runs in the page. */
async function readFormFields(page: Page): Promise<FormField[]> {
  // No named helper functions inside: tsx (esbuild keepNames) wraps them in a
  // `__name()` call that doesn't exist in the page and the evaluate would throw.
  const raw = await page.evaluate((limit) => {
    const out: Record<string, string | null>[] = [];
    for (const el of Array.from(document.querySelectorAll("input, textarea, select, button"))) {
      if (out.length >= limit) break;
      const type = el.getAttribute("type");
      if (el.tagName === "INPUT" && type === "hidden") continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || el.getClientRects().length === 0) continue;
      const labels = (el as HTMLInputElement).labels;
      out.push({
        tag: el.tagName.toLowerCase(),
        type,
        name: el.getAttribute("name"),
        id: el.id || null,
        label: (labels && labels[0]?.innerText) || el.getAttribute("aria-label") || (el.tagName === "BUTTON" ? (el as HTMLElement).innerText : null),
        placeholder: el.getAttribute("placeholder"),
        testId: el.getAttribute("data-testid") ?? el.getAttribute("data-test") ?? el.getAttribute("data-cy"),
      });
    }
    return out;
  }, SNAPSHOT_LIMITS.fields);

  const max = SNAPSHOT_LIMITS.fieldText;
  return raw.map((f) => ({
    tag: f.tag as FormField["tag"],
    type: clip(f.type, 40),
    name: clip(f.name, max),
    id: clip(f.id, max),
    label: clip(f.label, max),
    placeholder: clip(f.placeholder, max),
    testId: clip(f.testId, max),
  }));
}

export async function capture(browser: Browser, env: WorkerEnv, url: string, baseOrigin: string): Promise<PageSnapshot> {
  const guard = createNetworkGuard();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    await guardContext(context, guard, (line) => log("info", "Snapshot", { line: line.slice(0, 300) }));
    const page = await context.newPage();
    page.setDefaultTimeout(env.WORKER_STEP_TIMEOUT_MS);

    const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    // Give client-rendered pages a moment to draw; not fatal if the network never idles.
    await page.waitForLoadState("networkidle", { timeout: SETTLE_MS }).catch(() => undefined);

    const finalUrl = page.url();
    if (new URL(finalUrl).origin !== baseOrigin) {
      throw new Error(`The page redirected to ${new URL(finalUrl).origin}, outside the project (${baseOrigin})`);
    }

    const aria = await page.locator("body").ariaSnapshot({ timeout: env.WORKER_STEP_TIMEOUT_MS });
    return pageSnapshotSchema.parse({
      requestedUrl: url.slice(0, SNAPSHOT_LIMITS.url),
      finalUrl: finalUrl.slice(0, SNAPSHOT_LIMITS.url),
      httpStatus: response?.status() ?? null,
      title: (await page.title()).slice(0, SNAPSHOT_LIMITS.title),
      aria: aria.slice(0, SNAPSHOT_LIMITS.ariaChars),
      ariaTruncated: aria.length > SNAPSHOT_LIMITS.ariaChars,
      fields: await readFormFields(page),
    });
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function finish(db: WorkerClient, job: SnapshotJob, update: { snapshot?: PageSnapshot; error?: string }) {
  const { error } = await db
    .from("page_snapshots")
    .update({
      status: update.snapshot ? "done" : "failed",
      snapshot: (update.snapshot ?? null) as Json,
      error_message: update.error ? truncate(update.error, 2000) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running");
  if (error) log("error", "Failed to save page snapshot", { id: job.id, error: error.message });
}

/** Opens the requested page of the project and records what it contains. Never throws. */
export async function executeSnapshot(db: WorkerClient, env: WorkerEnv, job: SnapshotJob): Promise<void> {
  log("info", "Page snapshot started", { id: job.id, path: job.path });
  let browser: Browser | undefined;
  let timer: NodeJS.Timeout | undefined;
  try {
    const project = await db.from("projects").select("base_url").eq("id", job.project_id).single();
    if (project.error) throw new Error(`Project not found: ${project.error.message}`);

    const target = resolveGotoUrl(project.data.base_url, job.path);
    if (!target.ok) throw new Error(target.reason);
    const entry = await createNetworkGuard().check(target.url);
    if (!entry.allowed) throw new Error(`This URL is not allowed: ${entry.reason}`);

    browser = await chromium.launch({ headless: true });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`The page took longer than ${CAPTURE_TIMEOUT_MS / 1000} s to load`)), CAPTURE_TIMEOUT_MS);
    });
    const snapshot = await Promise.race([
      capture(browser, env, target.url, new URL(project.data.base_url).origin),
      timeout,
    ]);
    await finish(db, job, { snapshot });
    log("info", "Page snapshot finished", { id: job.id, finalUrl: snapshot.finalUrl, fields: snapshot.fields.length });
  } catch (error) {
    const message = errorMessage(error).split("\n")[0] ?? "Capture failed";
    log("warn", "Page snapshot failed", { id: job.id, error: message });
    await finish(db, job, { error: message });
  } finally {
    clearTimeout(timer);
    await browser?.close().catch(() => undefined);
  }
}
