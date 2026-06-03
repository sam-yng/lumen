import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertFound, assertNoDatabaseError } from "@/server/services/errors";

type Document = Tables<"documents">;
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

function cleanTitle(title: string) {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled";
}

export async function createDocument(
  ctx: ServiceContext,
  input: { title: string; folderId: string | null },
) {
  await assertFolderOwned(ctx, input.folderId);

  const { data, error } = await ctx.supabase
    .from<Document>("documents")
    .insert({
      user_id: ctx.userId,
      folder_id: input.folderId,
      title: cleanTitle(input.title),
      content_json: null,
      content_text: null,
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not create document");
  assertFound(data, "Document not found.");
  return data;
}

export async function updateDocument(
  ctx: ServiceContext,
  input: { id: string; title?: string; folderId?: string | null },
) {
  if ("folderId" in input) await assertFolderOwned(ctx, input.folderId ?? null);

  const values: Partial<Document> = {};
  if (input.title !== undefined) values.title = cleanTitle(input.title);
  if ("folderId" in input) values.folder_id = input.folderId ?? null;

  const { data, error } = await ctx.supabase
    .from<Document>("documents")
    .update(values)
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not update document");
  assertFound(data, "Document not found.");
  return data;
}

export async function deleteDocument(
  ctx: ServiceContext,
  input: { id: string },
) {
  const { data, error } = await ctx.supabase
    .from<Document>("documents")
    .delete()
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not delete document");
  assertFound(data, "Document not found.");
  return data;
}
