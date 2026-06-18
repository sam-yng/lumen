import type { Tables } from "@/server/db/database.types";
import type { LibraryNode } from "@/server/services/library-nodes";

type TagData = {
  tags: Tables<"tags">[];
  tagLinks: Tables<"tag_links">[];
};

export function tagsForNode(snapshot: TagData, nodeId: string) {
  const tagIds = new Set(
    snapshot.tagLinks
      .filter((link) => link.node_id === nodeId)
      .map((link) => link.tag_id),
  );
  return snapshot.tags.filter((tag) => tagIds.has(tag.id));
}

export function tagLinkForNode(
  snapshot: TagData,
  nodeId: string,
  tagId: string,
) {
  return snapshot.tagLinks.find(
    (link) => link.node_id === nodeId && link.tag_id === tagId,
  );
}

export function filterNodesBySelectedTags(
  nodes: LibraryNode[],
  tagLinks: Tables<"tag_links">[],
  selectedTagIds: ReadonlySet<string>,
) {
  if (selectedTagIds.size === 0) return nodes;
  const matchedNodeIds = new Set(
    tagLinks
      .filter((link) => selectedTagIds.has(link.tag_id))
      .map((link) => link.node_id),
  );
  return nodes.filter((node) => matchedNodeIds.has(node.id));
}
