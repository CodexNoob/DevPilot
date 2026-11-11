"use client";

import { useTransition } from "react";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitation, declineInvitation } from "../actions";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [pending, startTransition] = useTransition();

  const run = (action: typeof acceptInvitation) =>
    startTransition(async () => {
      const result = await action(invitationId);
      if (result?.status === "error") toast.error(result.message);
      else if (result?.status === "success") toast.success(result.message);
    });

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => run(acceptInvitation)} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />} Accept
      </Button>
      <Button size="sm" variant="outline" onClick={() => run(declineInvitation)} disabled={pending}>
        <XIcon aria-hidden /> Decline
      </Button>
    </div>
  );
}
