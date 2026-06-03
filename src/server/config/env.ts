import { z } from "zod";

/**
 * The single source of truth for environment access. Nothing else in the
 * codebase should read `process.env` directly.
 *
 * Parsing is lazy + memoized so that importing this module never throws at
 * load time (keeps `bun run check` / CI green without a populated env), and so
 * `NEXT_PUBLIC_*` references stay as literal `process.env.X` accesses that
 * Next.js can statically inline into the client bundle.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  // Server-only secret (service role). Client code must never call
  // `getServerEnv()`. The worker (M4) uses this and bypasses RLS — see SECURITY.md.
  SUPABASE_SECRET_KEY: z.string().min(1),
});

type PublicEnv = z.infer<typeof publicSchema>;
type ServerEnv = z.infer<typeof serverSchema>;

let publicEnv: PublicEnv | undefined;
let serverEnv: ServerEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (!publicEnv) {
    publicEnv = publicSchema.parse({
      // Literal accesses so Next.js inlines these in the browser bundle.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  }
  return publicEnv;
}

export function getServerEnv(): ServerEnv {
  if (!serverEnv) {
    serverEnv = serverSchema.parse({
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    });
  }
  return serverEnv;
}
