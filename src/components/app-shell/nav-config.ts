import {
  BriefcaseIcon,
  Building2Icon,
  FlaskConicalIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  MailIcon,
  PlayCircleIcon,
  SettingsIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { id: string; label: string; icon: LucideIcon; defaultOpen: boolean; items: readonly NavItem[] };

export const NAV_HOME: NavItem = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon };

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "testing",
    label: "Testing",
    icon: FlaskConicalIcon,
    defaultOpen: true,
    items: [
      { href: "/runs", label: "Test Runs", icon: PlayCircleIcon },
      { href: "/flaky", label: "Flaky Tests", icon: ShuffleIcon },
      { href: "/generator", label: "Test Generator", icon: SparklesIcon },
    ],
  },
  {
    id: "management",
    label: "Management",
    icon: Building2Icon,
    defaultOpen: true,
    items: [
      { href: "/clients", label: "Clients", icon: BriefcaseIcon },
      { href: "/projects", label: "Projects", icon: FolderKanbanIcon },
      { href: "/users", label: "Users", icon: UsersIcon },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    defaultOpen: false,
    items: [
      { href: "/settings", label: "Workspace", icon: SlidersHorizontalIcon },
      { href: "/workspaces/invitations", label: "Invitations", icon: MailIcon },
    ],
  },
];

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
