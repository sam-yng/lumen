import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";
import type { EnqueueTranscriptionPayload } from "@/server/services/uploads";

type FileRow = Tables<"files">;
type RecordingRow = Tables<"recordings">;

export async function retryRecordingTranscription(
  ctx: ServiceContext,
  input: {
    id: string;
    enqueueTranscription: (
      payload: EnqueueTranscriptionPayload,
    ) => Promise<unknown>;
  },
) {
  const { data: recording, error: recordingError } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(recordingError, "Could not load recording");
  assertFound(recording, "Recording not found.");

  if (recording.status !== "failed") {
    throw new ServiceError(
      "invalid_input",
      "Only failed recordings can be retried.",
    );
  }

  const { data: file, error: fileError } = await ctx.supabase
    .from<FileRow>("files")
    .select("*")
    .eq("id", recording.file_id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(fileError, "Could not load file");
  assertFound(file, "File not found.");

  const { data: updated, error: updateError } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .update({ status: "pending", error: null })
    .eq("id", recording.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(updateError, "Could not update recording");
  assertFound(updated, "Recording not found.");

  await input.enqueueTranscription({
    userId: ctx.userId,
    recordingId: updated.id,
    fileId: file.id,
    storageKey: file.storage_key,
  });

  return updated;
}
