import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/server/db/client";

/**
 * OAuth (PKCE) callback. The provider redirects back with a `code` we exchange
 * for a session. Used by Google sign-in (see signInWithGoogle).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/library";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", origin));
}
