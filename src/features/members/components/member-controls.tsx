"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, LogOutIcon, UserMinusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/lib/supabase/database.types";
import { changeMemberRole, removeMember, revokeInvitation } from "../actions";

type Role = Enums<"workspace_role">;

const LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

/** Native select that saves on change. Rendered only when the actor has a choice to make. */
export function MemberRoleSelect({
  userId,
  memberName,
  role,
  options,
}: {
  userId: string;
  memberName: string;
  role: Role;
  options: readonly Role[];
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<Role>(role);

  return (
    <select
      aria-label={`Role for ${memberName}`}
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as Role;
        const previous = value;
        setValue(next);
        startTransition(async () => {
          const result = await changeMemberRole(userId, next);
          if (result.status === "error") {
            setValue(previous);
            toast.error(result.message);
          } else if (result.status === "success") {
            toast.success(result.message);
          }
        });
      }}
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {LABEL[option]}
        </option>
      ))}
    </select>
  );
}

export function RemoveMemberButton({ userId, memberName, isSelf }: { userId: string; memberName: string; isSelf: boolean }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="sm" aria-label={isSelf ? "Leave workspace" : `Remove ${memberName}`}>
          {isSelf ? <LogOutIcon /> : <UserMinusIcon />}
          <span className="hidden sm:inline">{isSelf ? "Leave" : "Remove"}</span>
        </Button>
      }
      title={isSelf ? "Leave this workspace?" : `Remove ${memberName}?`}
      description={
        isSelf
          ? "You'll lose access to its projects and runs until someone invites you again."
          : "They'll lose access to this workspace's projects and runs. Their past runs are kept."
      }
      confirmLabel={isSelf ? "Leave workspace" : "Remove member"}
      onConfirm={() => removeMember(userId)}
    />
  );
}

export function RevokeInvitationButton({ invitationId, email }: { invitationId: string; email: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Revoke invitation for ${email}`}>
          <XIcon />
        </Button>
      }
      title={`Revoke the invitation for ${email}?`}
      description="They won't be able to join with it anymore. You can invite them again later."
      confirmLabel="Revoke"
      onConfirm={() => revokeInvitation(invitationId)}
    />
  );
}

/** Copies the instructions to share with an invitee (no email is sent). */
export function CopyInviteMessage({ email, siteUrl }: { email: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const invitationUrl = `${siteUrl}/login?next=${encodeURIComponent("/workspaces/invitations")}`;
  const message = `You've been invited to join a DevPilot workspace as ${email}. Sign up or sign in using this email, then accept the invitation here: ${invitationUrl}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(message);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Couldn't copy. Select and copy the message manually.");
        }
      }}
      aria-label={`Copy invitation message for ${email}`}
      title={`Copy invitation details for ${email}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy message"}</span>
    </Button>
  );
}
