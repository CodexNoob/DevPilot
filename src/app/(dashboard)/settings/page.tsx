import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, UsersIcon, BuildingIcon, ShieldCheckIcon } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createWorkspace, renameWorkspace } from "@/features/workspaces/actions";
import { DeleteWorkspaceDialog } from "@/features/workspaces/components/delete-workspace-dialog";
import { WorkspaceNameForm } from "@/features/workspaces/components/workspace-name-form";
import { listInvitations, listMembers } from "@/features/members/queries";
import { requireWorkspace, ROLE_LABEL } from "@/lib/workspace";

export const metadata: Metadata = { title: "Workspace settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Workspace settings" description="Manage the active workspace." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const { workspace, isAdmin, isOwner, workspaces } = await requireWorkspace();
  const [members, invitations] = await Promise.all([
    listMembers(workspace.id),
    isAdmin ? listInvitations(workspace.id) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={BuildingIcon} label="Workspace" value={workspace.name} detail={`${workspaces.length} ${workspaces.length === 1 ? "workspace" : "workspaces"} you belong to`} />
        <SummaryCard icon={UsersIcon} label="Team members" value={String(members.length)} detail={`${invitations.length} pending ${invitations.length === 1 ? "invitation" : "invitations"}`} />
        <SummaryCard icon={ShieldCheckIcon} label="Your role" value={ROLE_LABEL[workspace.role]} detail={isOwner ? "Full workspace control" : isAdmin ? "Can manage members and settings" : "Can work on projects and tests"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Your role here: {ROLE_LABEL[workspace.role]}.
            {!isAdmin && " Only owners and admins can rename the workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Keyed by name so the field resets after a rename elsewhere. */}
          <WorkspaceNameForm
            key={workspace.name}
            action={renameWorkspace}
            defaultName={workspace.name}
            submitLabel="Save"
            disabled={!isAdmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team access</CardTitle>
          <CardDescription>Manage workspace members, invite teammates, and set their access level.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{members.length} active {members.length === 1 ? "member" : "members"}{isAdmin ? ` · ${invitations.length} pending invitations` : ""}</p>
          <Link href="/users" className={buttonVariants({ variant: "outline" })}>
            Manage members <ArrowRightIcon />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New workspace</CardTitle>
          <CardDescription>Start a separate workspace, for example for another team or agency client.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceNameForm action={createWorkspace} label="Name" submitLabel="Create workspace" />
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Deleting the workspace removes all of its data for every member. Leave a workspace from the Users page
              instead if you only want to lose access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteWorkspaceDialog workspaceName={workspace.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof BuildingIcon; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardDescription className="flex items-center gap-2"><Icon className="size-4" aria-hidden />{label}</CardDescription>
        <CardTitle className="truncate text-lg">{value}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-2xl space-y-6" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
