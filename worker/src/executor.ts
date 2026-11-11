import type { Page } from "playwright";
import { describeStep, type TestStep } from "../../src/lib/test-steps";
import { resolveGotoUrl } from "./network-guard";
import { errorMessage } from "./log";

export type StepOptions = {
  baseUrl: string;
  stepTimeoutMs: number;
  /** Appends a line to the test's log. */
  log: (line: string) => void;
};

const POLL_MS = 100;

/** Polls `read` until `matches` holds or the timeout elapses; returns the last value seen. */
async function pollUntil<T>(read: () => Promise<T>, matches: (value: T) => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!matches(last)) {
    if (Date.now() >= deadline) return { ok: false as const, last };
    await new Promise((r) => setTimeout(r, POLL_MS));
    last = await read();
  }
  return { ok: true as const, last };
}

async function runStep(page: Page, step: TestStep, { baseUrl, stepTimeoutMs }: StepOptions): Promise<void> {
  const timeout = stepTimeoutMs;
  switch (step.action) {
    case "goto": {
      const target = resolveGotoUrl(baseUrl, step.path);
      if (!target.ok) throw new Error(target.reason);
      const response = await page.goto(target.url, { timeout, waitUntil: "load" });
      if (response && response.status() >= 400) throw new Error(`${target.url} responded ${response.status()}`);
      return;
    }
    case "click":
      return page.locator(step.selector).first().click({ timeout });
    case "fill":
      return page.locator(step.selector).first().fill(step.value, { timeout });
    case "press":
      return page.locator(step.selector).first().press(step.key, { timeout });
    case "select":
      await page.locator(step.selector).first().selectOption(step.value, { timeout });
      return;
    case "check":
      return page.locator(step.selector).first().check({ timeout });
    case "hover":
      return page.locator(step.selector).first().hover({ timeout });
    case "wait":
      return page.waitForTimeout(step.ms);
    case "expect-visible":
      return page.locator(step.selector).first().waitFor({ state: "visible", timeout });
    case "expect-hidden":
      return page.locator(step.selector).first().waitFor({ state: "hidden", timeout });
    case "expect-text": {
      const locator = page.locator(step.selector).first();
      await locator.waitFor({ state: "attached", timeout });
      const result = await pollUntil(
        () => locator.innerText({ timeout }).catch(() => ""),
        (text) => text.includes(step.text),
        timeout,
      );
      if (!result.ok) {
        throw new Error(
          `${step.selector} shows "${result.last.slice(0, 200)}", but the test expects it to contain "${step.text}". Update the expected text if the page is correct.`,
        );
      }
      return;
    }
    case "expect-url": {
      const result = await pollUntil(async () => page.url(), (url) => url.includes(step.pattern), timeout);
      if (!result.ok) {
        throw new Error(
          `The page is at "${result.last}", but the test expects the URL to contain "${step.pattern}". Update the expected URL if the page is correct.`,
        );
      }
      return;
    }
    case "expect-title": {
      const result = await pollUntil(() => page.title(), (title) => title.includes(step.text), timeout);
      if (!result.ok) {
        throw new Error(
          `The page title is "${result.last}", but the test expects it to contain "${step.text}". Update the expected title if the page is correct.`,
        );
      }
      return;
    }
  }
}

export type StepsOutcome = { ok: true } | { ok: false; error: string; failedStep: number };

/** Executes steps in order, logging each with its timing. Stops at the first failure. */
export async function executeSteps(page: Page, steps: readonly TestStep[], options: StepOptions): Promise<StepsOutcome> {
  for (const [index, step] of steps.entries()) {
    const label = `${index + 1}. ${describeStep(step)}`;
    const started = Date.now();
    try {
      await runStep(page, step, options);
      options.log(`✓ ${label} (${Date.now() - started} ms)`);
    } catch (error) {
      const message = errorMessage(error).split("\n")[0] ?? "Step failed";
      options.log(`✗ ${label} (${Date.now() - started} ms): ${message}`);
      return { ok: false, error: `Step ${index + 1} failed (${describeStep(step)}): ${message}`, failedStep: index };
    }
  }
  return { ok: true };
}
