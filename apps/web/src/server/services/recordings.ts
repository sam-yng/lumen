import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";
import { enforceRateLimit, LIMITS } from "@/server/services/rate-limit";
import {
  type EnqueueTranscriptionPayload,
  enqueueFailureMessage,
} from "@/server/services/uploads";

type NodeRow = Tables<"library_nodes">;
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

  // A retry re-enqueues transcription — count it against the same cap, before
  // we flip the recording back to pending.
  await enforceRateLimit(ctx, LIMITS.transcriptionEnqueue);

  const { data: node, error: nodeError } = await ctx.supabase
    .from<NodeRow>("library_nodes")
    .select("*")
    .eq("id", recording.node_id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(nodeError, "Could not load audio node");
  assertFound(node, "Audio node not found.");

  const { data: updated, error: updateError } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .update({ status: "pending", error: null })
    .eq("id", recording.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(updateError, "Could not update recording");
  assertFound(updated, "Recording not found.");

  try {
    await input.enqueueTranscription({
      userId: ctx.userId,
      recordingId: updated.id,
      nodeId: node.id,
      storageKey: node.storage_key ?? "",
    });
  } catch (enqueueError) {
    // We just flipped the recording back to "pending"; if the enqueue fails it
    // has no job behind it and would be stranded. Revert it to "failed" so it
    // stays retryable, then surface the error to the caller.
    const message = enqueueFailureMessage(enqueueError);
    const { error: revertError } = await ctx.supabase
      .from<RecordingRow>("recordings")
      .update({ status: "failed", error: message })
      .eq("id", updated.id)
      .eq("user_id", ctx.userId);
    assertNoDatabaseError(revertError, "Could not revert recording");
    throw new ServiceError("database", message);
  }

  return updated;
}
