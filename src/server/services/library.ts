import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertNoDatabaseError } from "@/server/services/errors";

export type LibrarySnapshot = {
  folders: Tables<"folders">[];
  documents: Tables<"documents">[];
  files: Tables<"files">[];
  tags: Tables<"tags">[];
  tagLinks: Tables<"tag_links">[];
};

async function selectOwnedRows<Row extends Record<string, unknown>>(
  ctx: ServiceContext,
  table: string,
  orderBy: string,
) {
  const { data, error } = await ctx.supabase
    .from<Row>(table)
    .select("*")
    .eq("user_id", ctx.userId)
    .order(orderBy);
  assertNoDatabaseError(error, `Could not load ${table}`);
  return data;
}

export async function getLibrarySnapshot(
  ctx: ServiceContext,
): Promise<LibrarySnapshot> {
  const [folders, documents, files, tags] = await Promise.all([
    selectOwnedRows<Tables<"folders">>(ctx, "folders", "name"),
    selectOwnedRows<Tables<"documents">>(ctx, "documents", "title"),
    selectOwnedRows<Tables<"files">>(ctx, "files", "name"),
    selectOwnedRows<Tables<"tags">>(ctx, "tags", "name"),
  ]);

  const { data: tagLinks, error } = await ctx.supabase
    .from<Tables<"tag_links">>("tag_links")
    .select("*")
    .order("target_type");
  assertNoDatabaseError(error, "Could not load tag links");

  const visibleTagIds = new Set(tags.map((tag) => tag.id));

  return {
    folders,
    documents,
    files,
    tags,
    tagLinks: tagLinks.filter((link) => visibleTagIds.has(link.tag_id)),
  };
}
