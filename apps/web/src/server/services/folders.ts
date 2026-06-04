import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";

type Folder = Tables<"folders">;

async function listFolders(ctx: ServiceContext) {
  const { data, error } = await ctx.supabase
    .from<Folder>("folders")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("name");
  assertNoDatabaseError(error, "Could not load folders");
  return data;
}

function assertFolderCanMove(
  folders: Folder[],
  id: string,
  parentId: string | null,
) {
  if (parentId === null) return;
  if (parentId === id) {
    throw new ServiceError(
      "invalid_input",
      "A folder cannot be moved into itself or a descendant.",
    );
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  assertFound(byId.get(id) ?? null, "Folder not found.");
  assertFound(byId.get(parentId) ?? null, "Parent folder not found.");

  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === id) {
      throw new ServiceError(
        "invalid_input",
        "A folder cannot be moved into itself or a descendant.",
      );
    }
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
}

function cleanName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled folder";
}

async function assertParentFolderOwned(
  ctx: ServiceContext,
  parentId: string | null,
) {
  if (parentId === null) return;
  const folders = await listFolders(ctx);
  assertFound(
    folders.find((folder) => folder.id === parentId) ?? null,
    "Parent folder not found.",
  );
}

export async function createFolder(
  ctx: ServiceContext,
  input: { name: string; parentId: string | null },
) {
  await assertParentFolderOwned(ctx, input.parentId);

  const { data, error } = await ctx.supabase
    .from<Folder>("folders")
    .insert({
      id: crypto.randomUUID(),
      user_id: ctx.userId,
      name: cleanName(input.name),
      parent_id: input.parentId,
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not create folder");
  assertFound(data, "Folder not found.");
  return data;
}

export async function updateFolder(
  ctx: ServiceContext,
  input: { id: string; name?: string; parentId?: string | null },
) {
  const values: Partial<Folder> = {};
  if (input.name !== undefined) values.name = cleanName(input.name);
  if ("parentId" in input) {
    const folders = await listFolders(ctx);
    assertFolderCanMove(folders, input.id, input.parentId ?? null);
    values.parent_id = input.parentId ?? null;
  }

  const { data, error } = await ctx.supabase
    .from<Folder>("folders")
    .update(values)
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not update folder");
  assertFound(data, "Folder not found.");
  return data;
}

export async function moveFolder(
  ctx: ServiceContext,
  input: { id: string; parentId: string | null },
) {
  const folders = await listFolders(ctx);
  assertFolderCanMove(folders, input.id, input.parentId);

  const { data, error } = await ctx.supabase
    .from<Folder>("folders")
    .update({ parent_id: input.parentId })
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not move folder");
  assertFound(data, "Folder not found.");
  return data;
}

export async function deleteFolder(ctx: ServiceContext, input: { id: string }) {
  const { data, error } = await ctx.supabase
    .from<Folder>("folders")
    .delete()
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not delete folder");
  assertFound(data, "Folder not found.");
  return data;
}
