import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/server/config/env";
import type { Database } from "@/server/db/database.types";

export function createWorkerSupabase() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SECRET_KEY } = getServerEnv();

  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
