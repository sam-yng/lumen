import type { Json, Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { extractTipTapText } from "@/server/services/editor-content";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";

export type LibraryNodeKind = Tables<"library_nodes">["kind"];
export type LibraryNode = Tables<"library_nodes">;

const CONTAINER_KINDS: LibraryNodeKind[] = ["workspace", "page"];

function slugFor(title: string, id: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = id.replace(/-/g, "").slice(0, 8);
  return base ? `${base}-${suffix}` : suffix;
}

function cleanTitle(title: string, fallback = "Untitled") {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

async function listNodes(ctx: ServiceContext) {
  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("title");
  assertNoDatabaseError(error, "Could not load library");
  return data;
}

function findNode(nodes: LibraryNode[], id: string) {
  return nodes.find((node) => node.id === id) ?? null;
}

function assertParentCanContainChildren(parent: LibraryNode) {
  if (!CONTAINER_KINDS.includes(parent.kind)) {
    throw new ServiceError(
      "invalid_input",
      "Files and audio nodes cannot contain children.",
    );
  }
}

function descendantIds(nodes: LibraryNode[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const node of nodes) {
      if (
        node.parent_id !== null &&
        ids.has(node.parent_id) &&
        !ids.has(node.id)
      ) {
        ids.add(node.id);
        added = true;
      }
    }
  }
  return ids;
}

function nodeHasChildren(nodes: LibraryNode[], id: string) {
  return nodes.some((node) => node.parent_id === id);
}

function assertMoveAllowed(
  nodes: LibraryNode[],
  ids: string[],
  parentId: string | null,
) {
  if (parentId !== null) {
    const parent = findNode(nodes, parentId);
    assertFound(parent, "Parent node not found.");
    assertParentCanContainChildren(parent);
  }

  for (const id of ids) {
    const node = findNode(nodes, id);
    assertFound(node, "Node not found.");
    if (node.kind === "workspace") {
      throw new ServiceError(
        "invalid_input",
        "Workspaces cannot be moved into another node.",
      );
    }
    if (parentId === null) continue;
    const blocked = descendantIds(nodes, id);
    if (blocked.has(parentId)) {
      throw new ServiceError(
        "invalid_input",
        "A node cannot be moved into itself or a descendant.",
      );
    }
  }
}

function assertPinEligible(nodes: LibraryNode[], node: LibraryNode) {
  if (node.kind === "workspace") return;
  if (node.kind === "page" && nodeHasChildren(nodes, node.id)) return;
  throw new ServiceError(
    "invalid_input",
    "Only workspaces and container pages can be pinned.",
  );
}

async function insertNode(ctx: ServiceContext, values: Partial<LibraryNode>) {
  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .insert(values)
    .select("*")
    .single();
  assertNoDatabaseError(error, "Could not create node");
  assertFound(data, "Node not found.");
  return data;
}

async function loadOwnedParent(ctx: ServiceContext, parentId: string) {
  const nodes = await listNodes(ctx);
  const parent = findNode(nodes, parentId);
  assertFound(parent, "Parent node not found.");
  assertParentCanContainChildren(parent);
  return parent;
}

export async function getLibraryNodeSnapshot(ctx: ServiceContext) {
  const nodes = await listNodes(ctx);
  return { nodes };
}

export async function createWorkspaceNode(
  ctx: ServiceContext,
  input: { title: string },
) {
  const id = crypto.randomUUID();
  const title = cleanTitle(input.title, "Untitled workspace");
  return insertNode(ctx, {
    id,
    user_id: ctx.userId,
    workspace_id: id,
    parent_id: null,
    kind: "workspace",
    title,
    slug: slugFor(title, id),
  });
}

export async function createPageNode(
  ctx: ServiceContext,
  input: { title: string; parentId: string },
) {
  const parent = await loadOwnedParent(ctx, input.parentId);
  const id = crypto.randomUUID();
  const title = cleanTitle(input.title);
  return insertNode(ctx, {
    id,
    user_id: ctx.userId,
    workspace_id: parent.workspace_id,
    parent_id: parent.id,
    kind: "page",
    title,
    slug: slugFor(title, id),
  });
}

export async function createFileNode(
  ctx: ServiceContext,
  input: {
    title: string;
    parentId: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  },
) {
  const parent = await loadOwnedParent(ctx, input.parentId);
  const id = crypto.randomUUID();
  const title = cleanTitle(input.title, "Untitled file");
  return insertNode(ctx, {
    id,
    user_id: ctx.userId,
    workspace_id: parent.workspace_id,
    parent_id: parent.id,
    kind: "file",
    title,
    slug: slugFor(title, id),
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    storage_key: input.storageKey,
  });
}

export async function createAudioNode(
  ctx: ServiceContext,
  input: {
    title: string;
    parentId: string | null;
    workspaceId: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  },
) {
  if (input.parentId !== null) {
    await loadOwnedParent(ctx, input.parentId);
  }
  const id = crypto.randomUUID();
  const title = cleanTitle(input.title, "Untitled recording");
  return insertNode(ctx, {
    id,
    user_id: ctx.userId,
    workspace_id: input.workspaceId,
    parent_id: input.parentId,
    kind: "audio",
    title,
    slug: slugFor(title, id),
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    storage_key: input.storageKey,
  });
}

export async function updateLibraryNode(
  ctx: ServiceContext,
  input: {
    id: string;
    title?: string;
    parentId?: string | null;
    contentJson?: Json | null;
    isPinned?: boolean;
  },
) {
  const values: Partial<LibraryNode> = {};
  let nodes: LibraryNode[] | null = null;

  if (input.title !== undefined) values.title = cleanTitle(input.title);
  if ("contentJson" in input) {
    values.content_json = input.contentJson ?? null;
    values.content_text = extractTipTapText(input.contentJson ?? null);
  }
  if ("parentId" in input) {
    nodes = await listNodes(ctx);
    assertMoveAllowed(nodes, [input.id], input.parentId ?? null);
    values.parent_id = input.parentId ?? null;
    if (input.parentId !== null && input.parentId !== undefined) {
      const parent = findNode(nodes, input.parentId);
      if (parent) values.workspace_id = parent.workspace_id;
    }
  }
  if (input.isPinned !== undefined) {
    if (input.isPinned) {
      nodes = nodes ?? (await listNodes(ctx));
      const node = findNode(nodes, input.id);
      assertFound(node, "Node not found.");
      assertPinEligible(nodes, node);
    }
    values.is_pinned = input.isPinned;
  }

  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .update(values)
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(error, "Could not update node");
  assertFound(data, "Node not found.");
  return data;
}

export async function bulkMoveLibraryNodes(
  ctx: ServiceContext,
  input: { ids: string[]; parentId: string | null },
) {
  if (input.ids.length === 0) return [];
  const nodes = await listNodes(ctx);
  assertMoveAllowed(nodes, input.ids, input.parentId);

  const workspaceId =
    input.parentId !== null
      ? (findNode(nodes, input.parentId)?.workspace_id ?? null)
      : null;
  const values: Partial<LibraryNode> = { parent_id: input.parentId };
  if (workspaceId) values.workspace_id = workspaceId;

  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .update(values)
    .eq("user_id", ctx.userId)
    .in("id", input.ids)
    .select("*");

  assertNoDatabaseError(error, "Could not move nodes");
  return data;
}

export async function bulkDeleteLibraryNodes(
  ctx: ServiceContext,
  input: { ids: string[] },
) {
  if (input.ids.length === 0) return [];
  const nodes = await listNodes(ctx);

  const toDelete = new Set<string>();
  for (const id of input.ids) {
    const node = findNode(nodes, id);
    assertFound(node, "Node not found.");
    for (const descendantId of descendantIds(nodes, id)) {
      toDelete.add(descendantId);
    }
  }

  const ids = [...toDelete];
  const { data, error } = await ctx.supabase
    .from<LibraryNode>("library_nodes")
    .delete()
    .eq("user_id", ctx.userId)
    .in("id", ids)
    .select("*");

  assertNoDatabaseError(error, "Could not delete nodes");
  return data;
}
