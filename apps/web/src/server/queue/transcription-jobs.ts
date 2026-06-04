import { PgBoss, type SendOptions } from "pg-boss";
import { z } from "zod";

export const TRANSCRIPTION_QUEUE_NAME = "transcribe-recording";

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
