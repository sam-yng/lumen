import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/server/db/client";

/**
 * Email-link confirmation (canonical @supabase/ssr flow). The link carries
 * `token_hash` + `type`; verify it server-side with `verifyOtp` (NOT
 * `exchangeCodeForSession`, which is for the OAuth code flow). Used by the
 * password-recovery link (`type=recovery`, forwards to /reset-password) and any
 * other emailed confirmation link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/library";

  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirm", origin));
}
