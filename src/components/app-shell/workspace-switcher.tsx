import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { listMyWorkspaces, requireWorkspace } from "@/lib/workspace";
import { WorkspaceSwitcherMenu } from "./workspace-switcher-menu";

/** Reads the session, so it must render inside a Suspense boundary. */
export async function WorkspaceSwitcher() {
  // Don't call requireWorkspace() blindly: it redirects users without a
  // workspace to /workspaces/new, which renders this same shell.
  const workspaces = await listMyWorkspaces();
  if (workspaces.length === 0) {
    return (
      <Link
        href="/workspaces/new"
        className="flex items-center gap-2 rounded-lg border border-dashed border-sidebar-border p-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent"
      >
        <PlusIcon className="size-4" aria-hidden /> Create a workspace
      </Link>
    );
  }
  const { workspace } = await requireWorkspace();
  return <WorkspaceSwitcherMenu current={workspace} workspaces={workspaces} />;
}
