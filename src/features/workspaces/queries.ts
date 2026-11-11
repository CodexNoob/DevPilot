import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type MyInvitation = Database["public"]["Functions"]["my_invitations"]["Returns"][number];

/**
 * Pending invitations addressed to the signed-in user's email, with the
 * workspace name. Uses the `my_invitations()` function because the invitee
 * isn't a member yet, so RLS would hide the workspace row.
 */
export const listMyInvitations = cache(async (): Promise<MyInvitation[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invitations");
  if (error) throw new Error("Failed to load invitations", { cause: error });
  return data ?? [];
});
