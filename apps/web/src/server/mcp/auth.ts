import { createTokenSupabase } from "@/server/db/client";
import type {
  ServiceContext,
  ServiceSupabaseClient,
} from "@/server/services/context";

type ResolvedUser = { userId: string; supabase: ServiceSupabaseClient } | null;

/** Validate a bearer token against Supabase and bind a user-scoped client. */
async function resolveUserFromToken(token: string): Promise<ResolvedUser> {
  const supabase = createTokenSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;
  return {
    userId: user.id,
    supabase: supabase as unknown as ServiceSupabaseClient,
  };
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function getMcpServiceContext(
  request: Request,
  deps: { resolveUser?: (token: string) => Promise<ResolvedUser> } = {},
): Promise<ServiceContext | null> {
  const token = extractBearer(request);
  if (!token) return null;

  const resolveUser = deps.resolveUser ?? resolveUserFromToken;
  const resolved = await resolveUser(token);
  if (!resolved) return null;

  return { userId: resolved.userId, supabase: resolved.supabase };
}
