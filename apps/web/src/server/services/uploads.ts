import { randomUUID } from "node:crypto";
import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";
import {
  createAudioNode,
  createFileNode,
  type LibraryNode,
} from "@/server/services/library-nodes";
import { enforceRateLimit, LIMITS } from "@/server/services/rate-limit";
import {
  type StorageProvider,
  storageKeyForUpload,
} from "@/server/services/storage-provider";

type RecordingRow = Tables<"recordings">;

export type EnqueueTranscriptionPayload = {
  userId: string;
  recordingId: string;
  nodeId: string;
  storageKey: string;
};

type CreateUploadedFileInput = {
  bucket: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  parentId: string;
  storage: StorageProvider;
  enqueueTranscription: (
    payload: EnqueueTranscriptionPayload,
  ) => Promise<unknown>;
};

function isAudioMimeType(mimeType: string) {
  return mimeType.toLowerCase().startsWith("audio/");
}

/**
 * Uploads are constrained to PDF documents and audio (audio flows into the
 * transcription pipeline). Everything else is rejected. The client `accept`
 * hint is UX-only and bypassable, so this server check is the real gate.
 */
export function isAllowedUploadMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  return normalized === "application/pdf" || isAudioMimeType(normalized);
}

async function getOwnedParent(ctx: ServiceContext, parentId: string) {
  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .select("*")
    .eq("id", parentId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  assertNoDatabaseError(error, "Could not load parent node");
  assertFound(data, "Parent node not found.");
  return data;
}

async function createRecordingRow(
  ctx: ServiceContext,
  input: { id: string; nodeId: string },
) {
  const { data, error } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .insert({
      id: input.id,
      user_id: ctx.userId,
      node_id: input.nodeId,
      status: "pending",
      duration_sec: null,
      error: null,
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not create recording");
  assertFound(data, "Recording not found.");
  return data;
}

export async function createUploadedFile(
  ctx: ServiceContext,
  input: CreateUploadedFileInput,
): Promise<{ node: LibraryNode; recording: RecordingRow | null }> {
  if (!isAllowedUploadMimeType(input.mimeType)) {
    throw new ServiceError(
      "invalid_input",
      "Only PDF and audio files can be uploaded.",
    );
  }

  const parent = await getOwnedParent(ctx, input.parentId);
  const uploadId = randomUUID();
  const storageKey = storageKeyForUpload(ctx.userId, input.name, uploadId);
  const isAudio = isAudioMimeType(input.mimeType);

  if (isAudio) {
    await enforceRateLimit(ctx, LIMITS.transcriptionEnqueue);
  }

  await input.storage.upload({
    bucket: input.bucket,
    key: storageKey,
    bytes: input.bytes,
    contentType: input.mimeType,
  });

  try {
    const metadata = {
      title: input.name,
      parentId: input.parentId,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      storageKey,
    };
    const node = isAudio
      ? await createAudioNode(ctx, {
          ...metadata,
          workspaceId: parent.workspace_id,
        })
      : await createFileNode(ctx, metadata);

    if (!isAudio) return { node, recording: null };

    const recording = await createRecordingRow(ctx, {
      id: randomUUID(),
      nodeId: node.id,
    });

    try {
      await input.enqueueTranscription({
        userId: ctx.userId,
        recordingId: recording.id,
        nodeId: node.id,
        storageKey,
      });
    } catch (enqueueError) {
      const failed = await markRecordingEnqueueFailed(
        ctx,
        recording.id,
        enqueueError,
      );
      return { node, recording: failed };
    }

    return { node, recording };
  } catch (error) {
    await input.storage.remove({ bucket: input.bucket, key: storageKey });
    throw error;
  }
}

export function enqueueFailureMessage(cause: unknown): string {
  return cause instanceof Error
    ? `Could not queue transcription: ${cause.message}`
    : "Could not queue transcription.";
}

async function markRecordingEnqueueFailed(
  ctx: ServiceContext,
  recordingId: string,
  cause: unknown,
): Promise<RecordingRow> {
  const { data, error } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .update({ status: "failed", error: enqueueFailureMessage(cause) })
    .eq("id", recordingId)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not mark recording failed");
  assertFound(data, "Recording not found.");
  return data;
}
