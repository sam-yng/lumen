import type { Database, Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertFound, assertNoDatabaseError } from "@/server/services/errors";

type FileRow = Tables<"files">;
type FileKind = Database["public"]["Enums"]["file_kind"];
type Folder = Tables<"folders">;

async function assertFolderOwned(ctx: ServiceContext, folderId: string | null) {
  if (folderId === null) return;

  const { data, error } = await ctx.supabase
    .from<Folder>("folders")
    .select("*")
    .eq("id", folderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load folder");
  assertFound(data, "Folder not found.");
}

function storageKeyForMetadata(userId: string, name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `metadata/${userId}/${slug || "file"}`;
}

export async function createFileMetadata(
  ctx: ServiceContext,
  input: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    kind: FileKind;
    folderId: string | null;
  },
) {
  await assertFolderOwned(ctx, input.folderId);

  const { data, error } = await ctx.supabase
    .from<FileRow>("files")
    .insert({
      user_id: ctx.userId,
      folder_id: input.folderId,
      name: input.name.trim(),
      mime_type: input.mimeType.trim(),
      size_bytes: input.sizeBytes,
      kind: input.kind,
      storage_key: storageKeyForMetadata(ctx.userId, input.name),
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not create file metadata");
  assertFound(data, "File not found.");
  return data;
}

export async function updateFileMetadata(
  ctx: ServiceContext,
  input: {
    id: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    kind?: FileKind;
    folderId?: string | null;
  },
) {
  if ("folderId" in input) await assertFolderOwned(ctx, input.folderId ?? null);

  const values: Partial<FileRow> = {};
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.mimeType !== undefined) values.mime_type = input.mimeType.trim();
  if (input.sizeBytes !== undefined) values.size_bytes = input.sizeBytes;
  if (input.kind !== undefined) values.kind = input.kind;
  if ("folderId" in input) values.folder_id = input.folderId ?? null;

  const { data, error } = await ctx.supabase
    .from<FileRow>("files")
    .update(values)
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not update file metadata");
  assertFound(data, "File not found.");
  return data;
}

export async function deleteFileMetadata(
  ctx: ServiceContext,
  input: { id: string },
) {
  const { data, error } = await ctx.supabase
    .from<FileRow>("files")
    .delete()
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not delete file metadata");
  assertFound(data, "File not found.");
  return data;
}
