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
  PG_BOSS_DATABASE_URL: z.string().url(),
  TRANSCRIPTION_STORAGE_BUCKET: z.string().min(1).default("library-files"),
  WHISPER_MODEL: z.string().min(1).default("base.en"),
  TRANSCRIPTION_TMP_DIR: z.string().min(1).default("/tmp/lumen-transcription"),
  // Speaker diarization (v3 m3). Off by default; when enabled the worker
  // labels batch transcript segments and degrades to null speakers on error.
  DIARIZATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DIARIZATION_SEGMENTATION_MODEL_PATH: z.string().min(1).optional(),
  DIARIZATION_EMBEDDING_MODEL_PATH: z.string().min(1).optional(),
  DIARIZATION_CLUSTER_THRESHOLD: z.coerce.number().gt(0).lt(1).default(0.9),
  // -1 lets the clustering threshold decide how many speakers there are.
  DIARIZATION_NUM_SPEAKERS: z.coerce.number().int().default(-1),
  // Stale live-session sweep (v4 m5): a live recording with no activity for
  // this many minutes is finalized from its stored segments or expired.
  LIVE_SESSION_STALE_MINUTES: z.coerce.number().int().positive().default(45),
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
      PG_BOSS_DATABASE_URL: process.env.PG_BOSS_DATABASE_URL,
      TRANSCRIPTION_STORAGE_BUCKET: process.env.TRANSCRIPTION_STORAGE_BUCKET,
      WHISPER_MODEL: process.env.WHISPER_MODEL,
      TRANSCRIPTION_TMP_DIR: process.env.TRANSCRIPTION_TMP_DIR,
      DIARIZATION_ENABLED: process.env.DIARIZATION_ENABLED,
      DIARIZATION_SEGMENTATION_MODEL_PATH:
        process.env.DIARIZATION_SEGMENTATION_MODEL_PATH,
      DIARIZATION_EMBEDDING_MODEL_PATH:
        process.env.DIARIZATION_EMBEDDING_MODEL_PATH,
      DIARIZATION_CLUSTER_THRESHOLD: process.env.DIARIZATION_CLUSTER_THRESHOLD,
      DIARIZATION_NUM_SPEAKERS: process.env.DIARIZATION_NUM_SPEAKERS,
      LIVE_SESSION_STALE_MINUTES: process.env.LIVE_SESSION_STALE_MINUTES,
    });
  }
  return serverEnv;
}
