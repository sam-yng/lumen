import type { Database, Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";

type Tag = Tables<"tags">;
type TagLink = Tables<"tag_links">;
type TargetType = Database["public"]["Enums"]["tag_target_type"];

const targetTableByType = {
  document: "documents",
  file: "files",
  recording: "recordings",
} satisfies Record<TargetType, string>;

function cleanTagName(name: string) {
  return name.trim();
}

async function assertTagOwned(ctx: ServiceContext, tagId: string) {
  const { data, error } = await ctx.supabase
    .from<Tag>("tags")
    .select("*")
    .eq("id", tagId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load tag");
  assertFound(data, "Tag not found.");
  return data;
}

async function assertTargetOwned(
  ctx: ServiceContext,
  targetType: TargetType,
  targetId: string,
) {
  const { data, error } = await ctx.supabase
    .from<Record<string, unknown>>(targetTableByType[targetType])
    .select("*")
    .eq("id", targetId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load target");
  assertFound(data, "Target not found.");
}

export async function createTag(
  ctx: ServiceContext,
  input: { name: string; color: string | null },
) {
  const name = cleanTagName(input.name);
  const { data: existing, error: existingError } = await ctx.supabase
    .from<Tag>("tags")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("name", name)
    .maybeSingle();

  assertNoDatabaseError(existingError, "Could not load tag");
  if (existing) {
    throw new ServiceError("conflict", "A tag with that name already exists.");
  }

  const { data, error } = await ctx.supabase
    .from<Tag>("tags")
    .insert({
      user_id: ctx.userId,
      name,
      color: input.color,
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not create tag");
  assertFound(data, "Tag not found.");
  return data;
}

export async function updateTag(
  ctx: ServiceContext,
  input: { id: string; name?: string; color?: string | null },
) {
  const values: Partial<Tag> = {};
  if (input.name !== undefined) values.name = cleanTagName(input.name);
  if ("color" in input) values.color = input.color ?? null;

  const { data, error } = await ctx.supabase
    .from<Tag>("tags")
    .update(values)
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not update tag");
  assertFound(data, "Tag not found.");
  return data;
}

export async function deleteTag(ctx: ServiceContext, input: { id: string }) {
  const { data, error } = await ctx.supabase
    .from<Tag>("tags")
    .delete()
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not delete tag");
  assertFound(data, "Tag not found.");
  return data;
}

export async function linkTagToTarget(
  ctx: ServiceContext,
  input: { tagId: string; targetType: TargetType; targetId: string },
) {
  await assertTagOwned(ctx, input.tagId);
  await assertTargetOwned(ctx, input.targetType, input.targetId);

  const { data: existing, error: existingError } = await ctx.supabase
    .from<TagLink>("tag_links")
    .select("*")
    .eq("tag_id", input.tagId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .maybeSingle();

  assertNoDatabaseError(existingError, "Could not load tag link");
  if (existing) return existing;

  const { data, error } = await ctx.supabase
    .from<TagLink>("tag_links")
    .insert({
      tag_id: input.tagId,
      target_type: input.targetType,
      target_id: input.targetId,
    })
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not link tag");
  assertFound(data, "Tag link not found.");
  return data;
}

export async function unlinkTag(
  ctx: ServiceContext,
  input: { linkId: string },
) {
  const { data, error } = await ctx.supabase
    .from<TagLink>("tag_links")
    .delete()
    .eq("id", input.linkId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not unlink tag");
  assertFound(data, "Tag link not found.");
  return data;
}
