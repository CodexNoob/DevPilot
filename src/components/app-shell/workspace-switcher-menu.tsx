"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspace } from "@/features/workspaces/actions";
import type { WorkspaceSummary } from "@/lib/workspace";

const ROLE: Record<WorkspaceSummary["role"], string> = { owner: "Owner", admin: "Admin", member: "Member" };

function WorkspaceMark({ name }: { name: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
      {name.trim().charAt(0).toUpperCase() || "W"}
    </span>
  );
}

export function WorkspaceSwitcherMenu({
  current,
  workspaces,
}: {
  current: WorkspaceSummary;
  workspaces: readonly WorkspaceSummary[];
}) {
  const [pending, startTransition] = useTransition();

  function select(id: string) {
    if (id === current.id) return;
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (result?.status === "error") toast.error(result.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-1.5 text-left text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label={`Workspace: ${current.name}. Switch workspace`}
      >
        <WorkspaceMark name={current.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{current.name}</span>
          <span className="block text-xs text-sidebar-foreground/60">{ROLE[current.role]}</span>
        </span>
        {pending ? (
          <Loader2Icon className="size-4 animate-spin text-sidebar-foreground/60" aria-hidden />
        ) : (
          <ChevronsUpDownIcon className="size-4 text-sidebar-foreground/60" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onClick={() => select(workspace.id)} disabled={pending}>
              <WorkspaceMark name={workspace.name} />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === current.id && <CheckIcon aria-label="Current workspace" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/workspaces/new" />}>
          <PlusIcon /> Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
