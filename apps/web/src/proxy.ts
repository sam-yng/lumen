import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicEnv } from "@/server/config/env";

/**
 * Next.js 16 Proxy (formerly `middleware`). Refreshes the Supabase session on
 * every request and guards the protected app shell: unauthenticated users are
 * redirected to /login; authenticated users are kept out of the auth pages.
 *
 * Proxy is not the only gate — protected Server Components also verify the user
 * (defense in depth), per the Next.js data-security guidance.
 */

// Paths reachable without a cookie session. `/api/mcp` authenticates external
// MCP hosts with a bearer Supabase JWT (not the cookie session), so the proxy
// must not redirect it to /login — the route handler enforces its own auth and
// returns 401 on a missing/invalid token.
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/api/mcp"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with the auth server; do not
  // trust getSession() in server code.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/library";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
