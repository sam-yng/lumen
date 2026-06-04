import { getServerEnv } from "@/server/config/env";
import { createTranscriptionBoss } from "@/server/queue/transcription-jobs";

let bossPromise: ReturnType<typeof createTranscriptionBoss> | null = null;

export function getTranscriptionBoss() {
  bossPromise ??= createTranscriptionBoss(getServerEnv().PG_BOSS_DATABASE_URL);
  return bossPromise;
}
