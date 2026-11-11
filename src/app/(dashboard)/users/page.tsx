import type { Metadata } from "next";
import { Suspense } from "react";
import { MailIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteForm } from "@/features/members/components/invite-form";
import {
  CopyInviteMessage,
  MemberRoleSelect,
  RemoveMemberButton,
  RevokeInvitationButton,
} from "@/features/members/components/member-controls";
import { listInvitations, listMembers } from "@/features/members/queries";
import { assignableRoles, canRemoveMember } from "@/features/workspaces/permissions";
import { publicEnv } from "@/lib/env";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireWorkspace, ROLE_LABEL } from "@/lib/workspace";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Users" description="People with access to this workspace and what they can do." />
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}

function initials(name: string | null, email: string | null): string {
  const parts = (name?.trim() || email || "?").split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

async function UsersContent() {
  const { workspace, user, isAdmin } = await requireWorkspace();
  const [members, invitations] = await Promise.all([
    listMembers(workspace.id),
    isAdmin ? listInvitations(workspace.id) : Promise.resolve([]),
  ]);
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Owners manage everything. Admins manage members, clients and deletions. Members work on projects and runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.userId === user.id;
                const name = member.displayName ?? member.email ?? "Unknown user";
                const roles = assignableRoles(workspace.role, member.role);
                return (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(member.displayName, member.email)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {name} {isSelf && <span className="text-muted-foreground">(you)</span>}
                          </div>
                          {member.email && member.displayName && (
                            <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {roles.length > 1 && !isSelf ? (
                        <MemberRoleSelect userId={member.userId} memberName={name} role={member.role} options={roles} />
                      ) : (
                        <Badge variant={member.role === "member" ? "outline" : "secondary"}>{ROLE_LABEL[member.role]}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <time dateTime={member.joinedAt} title={formatDateTime(member.joinedAt)}>
                        {timeAgo(member.joinedAt)}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      {canRemoveMember(workspace.role, member.role, isSelf) && (
                        <RemoveMemberButton userId={member.userId} memberName={name} isSelf={isSelf} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invite people</CardTitle>
            <CardDescription>
              Add a teammate, then copy the invitation instructions and share them. They must sign up or sign in with
              the invited email before they can accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <InviteForm />
            {invitations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Pending invitations</h3>
                <ul className="divide-y rounded-lg border">
                  {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate text-sm">{invitation.email}</span>
                        <Badge variant="outline">{ROLE_LABEL[invitation.role]}</Badge>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          invited {timeAgo(invitation.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CopyInviteMessage email={invitation.email} siteUrl={siteUrl} />
                        <RevokeInvitationButton invitationId={invitation.id} email={invitation.email} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading users">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
