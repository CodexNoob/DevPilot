import { requireUser } from "@/lib/auth";
import { UserMenuDropdown } from "./user-menu-dropdown";

/** Reads the session, so it must render inside a Suspense boundary. */
export async function UserMenu() {
  const user = await requireUser();
  return <UserMenuDropdown name={user.displayName} email={user.email} />;
}
