"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useSyncExternalStore } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_GROUPS, NAV_HOME, type NavGroup, type NavItem } from "./nav-config";

// ---------------------------------------------------------------------------
// Remembered open/closed state of nav groups (per browser).
// localStorage can be unavailable (private mode, blocked storage), so every
// access is guarded and an in-memory copy keeps the UI working regardless.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "devpilot.nav.groups";
const listeners = new Set<() => void>();
let memory = "";

function readGroups(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribeGroups(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parseGroups(raw: string): Record<string, boolean> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? (value as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function setGroupOpen(id: string, open: boolean) {
  memory = JSON.stringify({ ...parseGroups(readGroups()), [id]: open });
  try {
    window.localStorage.setItem(STORAGE_KEY, memory);
  } catch {
    // Ignore: the in-memory copy still updates the UI.
  }
  listeners.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------

const itemClass =
  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const activeClass = "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]";

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(itemClass, active && activeClass)}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Group({
  group,
  open,
  pathname,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  open: boolean;
  pathname: string | null;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const panelId = useId();
  const Icon = group.icon;
  return (
    <div className="border-t border-sidebar-border pt-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/55 uppercase outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Icon className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDownIcon className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden />
      </button>
      <ul id={panelId} hidden={!open} className="mt-1 ml-4 space-y-0.5 border-l border-sidebar-border pl-2">
        {group.items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static fallback rendered into the prerendered shell before the pathname is known. */
export function SidebarNavStatic({ className }: { className?: string }) {
  return (
    <nav className={cn("flex flex-col gap-3", className)} aria-label="Main">
      <NavLink item={NAV_HOME} active={false} />
      {NAV_GROUPS.map((group) => (
        <Group key={group.id} group={group} open={group.defaultOpen} pathname={null} />
      ))}
    </nav>
  );
}

export function SidebarNav({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const stored = parseGroups(useSyncExternalStore(subscribeGroups, readGroups, () => ""));

  return (
    <nav className={cn("flex flex-col gap-3", className)} aria-label="Main">
      <NavLink item={NAV_HOME} active={isActivePath(pathname, NAV_HOME.href)} onNavigate={onNavigate} />
      {NAV_GROUPS.map((group) => {
        const containsActive = group.items.some((item) => isActivePath(pathname, item.href));
        const open = stored[group.id] ?? (group.defaultOpen || containsActive);
        return (
          <Group
            key={group.id}
            group={group}
            open={open}
            pathname={pathname}
            onToggle={() => setGroupOpen(group.id, !open)}
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}
