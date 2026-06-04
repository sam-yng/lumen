import type { Database } from "@/server/db/database.types";
import type { LibrarySnapshot } from "@/server/services/library";

type TargetType = Database["public"]["Enums"]["tag_target_type"];

export function tagsForTarget(
  snapshot: LibrarySnapshot,
  targetType: TargetType,
  targetId: string,
) {
  const tagIds = new Set(
    snapshot.tagLinks
      .filter(
        (link) =>
          link.target_type === targetType && link.target_id === targetId,
      )
      .map((link) => link.tag_id),
  );
  return snapshot.tags.filter((tag) => tagIds.has(tag.id));
}

export function tagLinkForTarget(
  snapshot: LibrarySnapshot,
  targetType: TargetType,
  targetId: string,
  tagId: string,
) {
  return snapshot.tagLinks.find(
    (link) =>
      link.target_type === targetType &&
      link.target_id === targetId &&
      link.tag_id === tagId,
  );
}
