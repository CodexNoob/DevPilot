import type { Metadata } from "next";
import { Suspense } from "react";
import { MailOpenIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InvitationActions } from "@/features/workspaces/components/invitation-actions";
import { listMyInvitations } from "@/features/workspaces/queries";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/workspace";

export const metadata: Metadata = { title: "Invitations" };

export default function InvitationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Invitations" description="Workspaces you've been invited to join." />
      <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
        <InvitationList />
      </Suspense>
    </div>
  );
}

async function InvitationList() {
  const user = await requireUser();
  const invitations = await listMyInvitations();

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={MailOpenIcon}
        title="No pending invitations"
        description={`Invitations sent to ${user.email ?? "your email"} will appear here.`}
      />
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="divide-y">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="space-y-1">
                <p className="font-medium">{invitation.workspace_name}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {invitation.invited_by_name && <span>Invited by {invitation.invited_by_name} ·</span>}
                  Join as <Badge variant="secondary">{ROLE_LABEL[invitation.role]}</Badge>
                  <span>· {timeAgo(invitation.created_at)}</span>
                </p>
              </div>
              <InvitationActions invitationId={invitation.id} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
