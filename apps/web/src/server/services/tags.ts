import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";

type Tag = Tables<"tags">;
type TagLink = Tables<"tag_links">;
type LibraryNode = Tables<"library_nodes">;

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

async function assertNodeOwned(ctx: ServiceContext, nodeId: string) {
  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .select("*")
    .eq("id", nodeId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load node");
  assertFound(data, "Node not found.");
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

export async function linkTagToNode(
  ctx: ServiceContext,
  input: { tagId: string; nodeId: string },
) {
  await assertTagOwned(ctx, input.tagId);
  await assertNodeOwned(ctx, input.nodeId);

  const { data: existing, error: existingError } = await ctx.supabase
    .from<TagLink>("tag_links")
    .select("*")
    .eq("tag_id", input.tagId)
    .eq("node_id", input.nodeId)
    .maybeSingle();

  assertNoDatabaseError(existingError, "Could not load tag link");
  if (existing) return existing;

  const { data, error } = await ctx.supabase
    .from<TagLink>("tag_links")
    .insert({
      tag_id: input.tagId,
      node_id: input.nodeId,
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
  const { data: existing, error: existingError } = await ctx.supabase
    .from<TagLink>("tag_links")
    .select("*")
    .eq("id", input.linkId)
    .maybeSingle();

  assertNoDatabaseError(existingError, "Could not load tag link");
  assertFound(existing, "Tag link not found.");
  await assertTagOwned(ctx, existing.tag_id);

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

export async function setTagOnNodes(
  ctx: ServiceContext,
  input: { tagId: string; nodeIds: string[]; linked: boolean },
): Promise<TagLink[]> {
  const nodeIds = [...new Set(input.nodeIds)];
  if (nodeIds.length === 0) {
    throw new ServiceError("invalid_input", "Select at least one node.");
  }

  await assertTagOwned(ctx, input.tagId);

  const { data: nodes, error: nodesError } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .select("*")
    .in("id", nodeIds)
    .eq("user_id", ctx.userId);

  assertNoDatabaseError(nodesError, "Could not load nodes");
  if (nodes.length !== nodeIds.length) {
    throw new ServiceError("not_found", "Node not found.");
  }

  const { data: existing, error: existingError } = await ctx.supabase
    .from<TagLink>("tag_links")
    .select("*")
    .eq("tag_id", input.tagId)
    .in("node_id", nodeIds);

  assertNoDatabaseError(existingError, "Could not load tag links");

  if (!input.linked) {
    const { data, error } = await ctx.supabase
      .from<TagLink>("tag_links")
      .delete()
      .eq("tag_id", input.tagId)
      .in("node_id", nodeIds)
      .select("*");

    assertNoDatabaseError(error, "Could not unlink tags");
    return data;
  }

  const linkedNodeIds = new Set(existing.map((link) => link.node_id));
  const missingNodeIds = nodeIds.filter((nodeId) => !linkedNodeIds.has(nodeId));
  if (missingNodeIds.length === 0) return existing;

  const { data: inserted, error } = await ctx.supabase
    .from<TagLink>("tag_links")
    .insert(
      missingNodeIds.map((nodeId) => ({
        tag_id: input.tagId,
        node_id: nodeId,
      })),
    )
    .select("*");

  assertNoDatabaseError(error, "Could not link tags");
  return [...existing, ...inserted];
}

export async function listPageNodesByTag(
  ctx: ServiceContext,
  input: { tagId: string },
): Promise<LibraryNode[]> {
  await assertTagOwned(ctx, input.tagId);

  const { data: links, error } = await ctx.supabase
    .from<TagLink>("tag_links")
    .select("*")
    .eq("tag_id", input.tagId);

  assertNoDatabaseError(error, "Could not load tag links");

  const nodeIds = links.map((link) => link.node_id);

  if (nodeIds.length === 0) return [];

  const { data: pages, error: pagesError } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .select("*")
    .in("id", nodeIds)
    .eq("user_id", ctx.userId)
    .eq("kind", "page");

  assertNoDatabaseError(pagesError, "Could not load tagged pages");

  const orderById = new Map(nodeIds.map((id, index) => [id, index]));
  return [...pages].sort(
    (a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0),
  );
}
