import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/server/config/env";
import type { Database } from "@/server/db/database.types";

/**
 * Supabase client factories.
 *
 * Both clients use the PUBLISHABLE (anon) key and are bound to the user's
 * session, so every query runs under that user's RLS policies. The service-role
 * client — which bypasses RLS and must scope by user_id manually — is NOT built
 * here: it belongs to the transcription worker (M4). See SECURITY.md.
 */

/**
 * Bearer-token-bound client for non-cookie callers (the MCP server).
 *
 * Uses the PUBLISHABLE (anon) key plus the caller's Supabase JWT, so every
 * query runs under that user's RLS policies — the same guarantee as the
 * cookie clients, with NO service-role key and NO manual user_id scoping.
 */
export function createTokenSupabase(accessToken: string) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Client component / browser usage. */
export function createBrowserSupabase() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();
  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Server component / route handler / server action usage (cookie-bound). */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  return createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
