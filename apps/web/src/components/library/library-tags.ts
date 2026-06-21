import type { Tables } from "@/server/db/database.types";
import type { LibraryNode } from "@/server/services/library-nodes";

export function tagSelectionState(
  tagId: string,
  selectedNodeIds: ReadonlySet<string>,
  tagLinks: Tables<"tag_links">[],
): boolean | "indeterminate" {
  if (selectedNodeIds.size === 0) return false;

  const linkedNodeIds = new Set<string>();
  for (const link of tagLinks) {
    if (link.tag_id === tagId && selectedNodeIds.has(link.node_id)) {
      linkedNodeIds.add(link.node_id);
    }
  }
  if (linkedNodeIds.size === 0) return false;
  if (linkedNodeIds.size === selectedNodeIds.size) return true;
  return "indeterminate";
}

export function tagsByNodeId(
  tags: Tables<"tags">[],
  tagLinks: Tables<"tag_links">[],
): ReadonlyMap<string, Tables<"tags">[]> {
  const tagIdsByNode = new Map<string, Set<string>>();
  for (const link of tagLinks) {
    const tagIds = tagIdsByNode.get(link.node_id) ?? new Set<string>();
    tagIds.add(link.tag_id);
    tagIdsByNode.set(link.node_id, tagIds);
  }

  const grouped = new Map<string, Tables<"tags">[]>();
  for (const [nodeId, tagIds] of tagIdsByNode) {
    const assigned = tags.filter((tag) => tagIds.has(tag.id));
    if (assigned.length > 0) grouped.set(nodeId, assigned);
  }
  return grouped;
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
