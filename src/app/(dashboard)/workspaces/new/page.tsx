import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createWorkspace } from "@/features/workspaces/actions";
import { WorkspaceNameForm } from "@/features/workspaces/components/workspace-name-form";

export const metadata: Metadata = { title: "New workspace" };

/** Also the landing page when a user belongs to no workspace (see requireWorkspace). */
export default function NewWorkspacePage() {
  return (
    <div className="max-w-xl space-y-8">
      <PageHeader
        title="Create a workspace"
        description="A workspace holds your clients, projects and test runs, shared with the people you invite."
      />
      <Card>
        <CardContent>
          <WorkspaceNameForm action={createWorkspace} submitLabel="Create workspace" />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Expecting an invitation instead?{" "}
        <Link href="/workspaces/invitations" className="font-medium text-foreground hover:underline">
          Check your invitations
        </Link>
        .
      </p>
    </div>
  );
}
