import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertNoDatabaseError } from "@/server/services/errors";

type AiCredential = Tables<"user_ai_credentials">;
type GetApiKeyRow = { get_ai_api_key: string | null };

/** Save (insert or replace) the caller's Claude API key in Vault. */
export async function saveApiKey(
  ctx: ServiceContext,
  key: string,
): Promise<void> {
  const { error } = await ctx.supabase.rpc("set_ai_api_key", { p_key: key });
  assertNoDatabaseError(error, "Could not save API key");
}

/** Whether the caller has a key set. Never returns key material. */
export async function hasApiKey(ctx: ServiceContext): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from<AiCredential>("user_ai_credentials")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not check API key");
  return data !== null;
}

/** Server-only: decrypt and return the caller's key, or null if unset. */
export async function getDecryptedApiKey(
  ctx: ServiceContext,
): Promise<string | null> {
  const { data, error } = await ctx.supabase.rpc<GetApiKeyRow>(
    "get_ai_api_key",
    {},
  );

  assertNoDatabaseError(error, "Could not load API key");
  return data[0]?.get_ai_api_key ?? null;
}

/** Delete the caller's key (row + Vault secret). */
export async function deleteApiKey(ctx: ServiceContext): Promise<void> {
  const { error } = await ctx.supabase.rpc("delete_ai_api_key", {});
  assertNoDatabaseError(error, "Could not delete API key");
}
