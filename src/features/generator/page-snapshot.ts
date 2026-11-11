import "server-only";
import { createClient } from "@/lib/supabase/server";
import { pageSnapshotSchema, type PageSnapshot } from "@/lib/page-snapshot";

/** How long "Generate tests" waits for the worker to open the page. */
const WAIT_MS = 60_000;
const POLL_MS = 1000;

export type SnapshotResult = { ok: true; snapshot: PageSnapshot } | { ok: false; message: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the worker to open `path` on the project's site and waits for the
 * result. The web app never fetches user-supplied URLs itself: the worker does,
 * behind its SSRF guard. RLS limits requests to projects the caller can access.
 */
export async function capturePage(projectId: string, path: string): Promise<SnapshotResult> {
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("page_snapshots")
    .insert({ project_id: projectId, path })
    .select("id")
    .single();
  if (error) {
    console.error("[generator] snapshot request", error.message);
    return { ok: false, message: "Couldn't ask the worker to open the page. Please try again." };
  }

  const deadline = Date.now() + WAIT_MS;
  let lastStatus = "queued";
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const { data, error: readError } = await supabase
      .from("page_snapshots")
      .select("status, snapshot, error_message")
      .eq("id", request.id)
      .single();
    if (readError) {
      console.error("[generator] snapshot poll", readError.message);
      return { ok: false, message: "Couldn't read the page capture. Please try again." };
    }
    lastStatus = data.status;
    if (data.status === "failed") {
      return { ok: false, message: `DevPilot couldn't open ${path}: ${data.error_message ?? "unknown error"}` };
    }
    if (data.status === "done") {
      const parsed = pageSnapshotSchema.safeParse(data.snapshot);
      if (!parsed.success) return { ok: false, message: "The page capture was unreadable. Please try again." };
      return { ok: true, snapshot: parsed.data };
    }
  }

  return {
    ok: false,
    message:
      lastStatus === "queued"
        ? "The DevPilot worker didn't pick up the request to open the page. Make sure the worker is running (npm run worker) and try again."
        : `Opening ${path} took too long. Check that the page loads, then try again.`,
  };
}
