import { randomUUID } from "node:crypto";
import type { Database, Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertFound, assertNoDatabaseError } from "@/server/services/errors";
import { enforceRateLimit, LIMITS } from "@/server/services/rate-limit";
import {
  type StorageProvider,
  storageKeyForUpload,
} from "@/server/services/storage-provider";

type FileRow = Tables<"files">;
type FolderRow = Tables<"folders">;
type RecordingRow = Tables<"recordings">;
type FileKind = Database["public"]["Enums"]["file_kind"];

export type EnqueueTranscriptionPayload = {
  userId: string;
  recordingId: string;
  fileId: string;
  storageKey: string;
};

type CreateUploadedFileInput = {
  bucket: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  folderId: string | null;
  storage: StorageProvider;
  enqueueTranscription: (
    payload: EnqueueTranscriptionPayload,
  ) => Promise<unknown>;
};

function isAudioMimeType(mimeType: string) {
  return mimeType.toLowerCase().startsWith("audio/");
}

async function assertFolderOwned(ctx: ServiceContext, folderId: string | null) {
  if (folderId === null) return;

  const { data, error } = await ctx.supabase
    .from<FolderRow>("folders")
    .select("*")
    .eq("id", folderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load folder");
  assertFound(data, "Folder not found.");
}

async function createFileRow(
  ctx: ServiceContext,
  input: {
    id: string;
    folderId: string | null;
    name: string;
    mimeType: string;
    sizeBytes: number;
    kind: FileKind;
    storageKey: string;
  },
) {
  const { data, error } = await ctx.supabase
    .from<FileRow>("files")
    .insert({
      id: input.id,
      user_id: ctx.userId,
      folder_id: input.folderId,
      name: input.name.trim(),
      mime_type: input.mimeType.trim(),
      size_bytes: input.sizeBytes,
      kind: input.kind,
      storage_key: input.storageKey,
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not create file");
  assertFound(data, "File not found.");
  return data;
}

async function createRecordingRow(
  ctx: ServiceContext,
  input: { id: string; fileId: string },
) {
  const { data, error } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .insert({
      id: input.id,
      user_id: ctx.userId,
      file_id: input.fileId,
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
): Promise<{ file: FileRow; recording: RecordingRow | null }> {
  await assertFolderOwned(ctx, input.folderId);

  const fileId = randomUUID();
  const storageKey = storageKeyForUpload(ctx.userId, input.name, fileId);
  const kind: FileKind = isAudioMimeType(input.mimeType) ? "audio" : "other";

  // Cap audio enqueues per user (transcription is the cost-sensitive path).
  // Enforce before any storage/DB write so a limited upload leaves no orphans.
  if (kind === "audio") {
    await enforceRateLimit(ctx, LIMITS.transcriptionEnqueue);
  }

  await input.storage.upload({
    bucket: input.bucket,
    key: storageKey,
    bytes: input.bytes,
    contentType: input.mimeType,
  });

  try {
    const file = await createFileRow(ctx, {
      id: fileId,
      folderId: input.folderId,
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      kind,
      storageKey,
    });

    if (kind !== "audio") return { file, recording: null };

    const recording = await createRecordingRow(ctx, {
      id: randomUUID(),
      fileId: file.id,
    });

    await input.enqueueTranscription({
      userId: ctx.userId,
      recordingId: recording.id,
      fileId: file.id,
      storageKey: file.storage_key,
    });

    return { file, recording };
  } catch (error) {
    await input.storage.remove({ bucket: input.bucket, key: storageKey });
    throw error;
  }
}
