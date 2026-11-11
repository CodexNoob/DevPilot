import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/routes";

/**
 * Landing point for Supabase email links (signup confirmation). Supports both:
 *
 * - `?token_hash=…&type=…` (recommended): verified server-side with verifyOtp.
 *   Works when the link is opened in a different browser or device than the
 *   one used to sign up. Requires the email template to link here, e.g.
 *   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`.
 * - `?code=…` (PKCE, default template): only works in the browser that signed
 *   up, because it needs the code-verifier cookie set at sign-up.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth.callback] verifyOtp", error.code, error.message);
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth.callback] exchangeCode", error.code, error.message);
  } else {
    // Supabase forwards its own failures (e.g. otp_expired) as query params.
    console.error(
      "[auth.callback] no code or token_hash",
      searchParams.get("error_code"),
      searchParams.get("error_description"),
    );
  }

  return NextResponse.redirect(new URL("/login?error=confirmation_failed", origin));
}
