import { PgBoss, type SendOptions } from "pg-boss";
import { z } from "zod";

export const TRANSCRIPTION_QUEUE_NAME = "transcribe-recording";
export const SPEAKER_LABEL_QUEUE_NAME = "label-speakers";
export const STALE_LIVE_SWEEP_QUEUE_NAME = "sweep-stale-live-sessions";

const postgresUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

const transcriptionJobOptions = {
  expireInSeconds: 60 * 60,
  retryBackoff: true,
  retryDelay: 30,
  retryLimit: 3,
} satisfies SendOptions;

export const transcriptionJobPayloadSchema = z.object({
  userId: postgresUuidSchema,
  recordingId: postgresUuidSchema,
  fileId: postgresUuidSchema,
  storageKey: z.string().min(1),
});

export type TranscriptionJobPayload = z.infer<
  typeof transcriptionJobPayloadSchema
>;

// Speaker labeling (v4 m4) reuses the transcription payload shape: the job
// needs the same authenticated identifiers to download the finalized live
// audio and update that user's segments.
export const speakerLabelJobPayloadSchema = transcriptionJobPayloadSchema;
export type SpeakerLabelJobPayload = TranscriptionJobPayload;

export interface TranscriptionJobQueue {
  send(
    name: string,
    payload: TranscriptionJobPayload,
    options: SendOptions,
  ): Promise<string | null>;
}

export async function createTranscriptionBoss(
  connectionString: string,
): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString });
  await boss.start();
  await boss.createQueue(TRANSCRIPTION_QUEUE_NAME);
  await boss.createQueue(SPEAKER_LABEL_QUEUE_NAME);
  await boss.createQueue(STALE_LIVE_SWEEP_QUEUE_NAME);
  return boss;
}

export async function enqueueTranscriptionJob(
  boss: TranscriptionJobQueue,
  payload: unknown,
): Promise<string> {
  const parsedPayload = transcriptionJobPayloadSchema.parse(payload);
  const jobId = await boss.send(
    TRANSCRIPTION_QUEUE_NAME,
    parsedPayload,
    transcriptionJobOptions,
  );

  if (!jobId) {
    throw new Error("Failed to enqueue transcription job.");
  }

  return jobId;
}

/**
 * Enqueue a post-finalize speaker labeling job for a live session.
 *
 * Labeling is an enhancement on top of an already-finalized transcript, so
 * this never throws: env-off means no job, and an enqueue failure logs and
 * leaves the transcript with null speakers (degrade-never-fail).
 */
export async function enqueueSpeakerLabelJob(input: {
  enabled: boolean;
  getBoss: () => Promise<TranscriptionJobQueue>;
  payload: unknown;
}): Promise<string | null> {
  if (!input.enabled) return null;

  try {
    const parsedPayload = speakerLabelJobPayloadSchema.parse(input.payload);
    const boss = await input.getBoss();
    const jobId = await boss.send(
      SPEAKER_LABEL_QUEUE_NAME,
      parsedPayload,
      transcriptionJobOptions,
    );

    if (!jobId) throw new Error("Failed to enqueue speaker labeling job.");
    return jobId;
  } catch (error) {
    console.error(
      `Could not enqueue speaker labeling job; live transcript keeps null speakers: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
