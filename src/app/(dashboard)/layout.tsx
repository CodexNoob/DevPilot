import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { InvitationsNotice } from "@/components/app-shell/invitations-notice";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { SidebarNav, SidebarNavStatic } from "@/components/app-shell/nav-links";
import { UserMenu } from "@/components/app-shell/user-menu";
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Authenticated app shell. The chrome is static and prerendered; everything
 * that reads the session (workspace switcher, user menu, invitations, page
 * data) streams in behind Suspense. Access control does not depend on this
 * layout: the proxy redirects early, and every page/action re-checks the user
 * via the data access layer.
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  const brand = (
    <div className="space-y-3">
      <div className="flex h-10 items-center px-1.5">
        <Logo href="/dashboard" />
      </div>
      <Suspense fallback={<Skeleton className="h-11 w-full rounded-lg" />}>
        <WorkspaceSwitcher />
      </Suspense>
    </div>
  );

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex">
        {brand}
        <Suspense fallback={<SidebarNavStatic />}>
          <SidebarNav />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6">
          <MobileNav header={brand} />
          <div className="md:hidden">
            <Logo href="/dashboard" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={null}>
              <InvitationsNotice />
            </Suspense>
            <div className="w-44 sm:w-52">
              <Suspense fallback={<Skeleton className="h-9 w-full" />}>
                <UserMenu />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
