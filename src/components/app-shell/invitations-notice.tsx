import Link from "next/link";
import { MailIcon } from "lucide-react";
import { listMyInvitations } from "@/features/workspaces/queries";

/** Top-bar link shown only while the user has pending workspace invitations. */
export async function InvitationsNotice() {
  const invitations = await listMyInvitations();
  if (invitations.length === 0) return null;
  const count = invitations.length;

  return (
    <Link
      href="/workspaces/invitations"
      className="relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={`${count} pending workspace ${count === 1 ? "invitation" : "invitations"}`}
    >
      <MailIcon className="size-4" aria-hidden />
      <span className="hidden sm:inline">Invitations</span>
      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
        {count}
      </span>
    </Link>
  );
}
