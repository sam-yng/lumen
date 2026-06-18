import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/library/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/library/http")>(
    "@/app/api/library/http",
  );
  return { ...actual, getRouteServiceContext: vi.fn() };
});
vi.mock("@/server/services/library-nodes", () => ({
  createPageNode: vi.fn(),
  createWorkspaceNode: vi.fn(),
  updateLibraryNode: vi.fn(),
  bulkMoveLibraryNodes: vi.fn(),
  bulkDeleteLibraryNodes: vi.fn(),
}));

import { getRouteServiceContext } from "@/app/api/library/http";
import { PATCH } from "@/app/api/library/nodes/[id]/route";
import { POST as bulkDelete } from "@/app/api/library/nodes/bulk-delete/route";
import { POST as bulkMove } from "@/app/api/library/nodes/bulk-move/route";
import { POST } from "@/app/api/library/nodes/route";
import { ServiceError } from "@/server/services/errors";
import {
  bulkDeleteLibraryNodes,
  bulkMoveLibraryNodes,
  createPageNode,
  createWorkspaceNode,
  updateLibraryNode,
} from "@/server/services/library-nodes";

const ctx = { userId: "user-1", supabase: {} } as never;
const nodeId = "11111111-1111-4111-8111-111111111111";
const parentId = "22222222-2222-4222-8222-222222222222";
const seededParentId = "00000000-0000-0000-0000-0000000000f1";

function request(path: string, body: unknown) {
  return new Request(`http://x/api/library/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("library node routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
  });

  it("creates workspace and page nodes from the discriminated request body", async () => {
    vi.mocked(createWorkspaceNode).mockResolvedValue({ id: nodeId } as never);
    vi.mocked(createPageNode).mockResolvedValue({ id: nodeId } as never);

    const workspaceResponse = await POST(
      request("nodes", { kind: "workspace", title: "Research" }),
    );
    const pageResponse = await POST(
      request("nodes", { kind: "page", title: "Notes", parentId }),
    );

    expect(workspaceResponse.status).toBe(201);
    expect(createWorkspaceNode).toHaveBeenCalledWith(ctx, {
      title: "Research",
    });
    expect(pageResponse.status).toBe(201);
    expect(createPageNode).toHaveBeenCalledWith(ctx, {
      title: "Notes",
      parentId,
    });
  });

  it("accepts UUID-shaped seeded node ids when creating a note", async () => {
    vi.mocked(createPageNode).mockResolvedValue({ id: nodeId } as never);

    const response = await POST(
      request("nodes", {
        kind: "page",
        title: "Seed child",
        parentId: seededParentId,
        role: "note",
      }),
    );

    expect(response.status).toBe(201);
    expect(createPageNode).toHaveBeenCalledWith(ctx, {
      title: "Seed child",
      parentId: seededParentId,
      role: "note",
    });
  });

  it("rejects invalid create and update bodies before calling services", async () => {
    const createResponse = await POST(
      request("nodes", { kind: "audio", title: "Recording" }),
    );
    const updateResponse = await PATCH(
      request(`nodes/${nodeId}`, { title: "" }),
      { params: Promise.resolve({ id: nodeId }) },
    );

    expect(createResponse.status).toBe(400);
    expect(updateResponse.status).toBe(400);
    expect(createWorkspaceNode).not.toHaveBeenCalled();
    expect(createPageNode).not.toHaveBeenCalled();
    expect(updateLibraryNode).not.toHaveBeenCalled();
  });

  it("updates a node using the route id", async () => {
    vi.mocked(updateLibraryNode).mockResolvedValue({ id: nodeId } as never);

    const response = await PATCH(
      request(`nodes/${nodeId}`, {
        title: "Renamed",
        parentId: null,
        contentJson: { type: "doc", content: [] },
        isPinned: true,
      }),
      { params: Promise.resolve({ id: nodeId }) },
    );

    expect(response.status).toBe(200);
    expect(updateLibraryNode).toHaveBeenCalledWith(ctx, {
      id: nodeId,
      title: "Renamed",
      parentId: null,
      contentJson: { type: "doc", content: [] },
      isPinned: true,
    });
  });

  it("does not synthesize omitted optional update fields", async () => {
    vi.mocked(updateLibraryNode).mockResolvedValue({ id: nodeId } as never);

    await PATCH(request(`nodes/${nodeId}`, { title: "Renamed" }), {
      params: Promise.resolve({ id: nodeId }),
    });

    expect(updateLibraryNode).toHaveBeenCalledWith(ctx, {
      id: nodeId,
      title: "Renamed",
    });
    expect(vi.mocked(updateLibraryNode).mock.calls[0]?.[1]).not.toHaveProperty(
      "contentJson",
    );
  });

  it("validates and dispatches bulk move and bulk delete requests", async () => {
    vi.mocked(bulkMoveLibraryNodes).mockResolvedValue([]);
    vi.mocked(bulkDeleteLibraryNodes).mockResolvedValue([]);

    const invalidMove = await bulkMove(
      request("nodes/bulk-move", { ids: [], parentId }),
    );
    const moveResponse = await bulkMove(
      request("nodes/bulk-move", { ids: [nodeId], parentId }),
    );
    const deleteResponse = await bulkDelete(
      request("nodes/bulk-delete", { ids: [nodeId] }),
    );

    expect(invalidMove.status).toBe(400);
    expect(moveResponse.status).toBe(200);
    expect(bulkMoveLibraryNodes).toHaveBeenCalledWith(ctx, {
      ids: [nodeId],
      parentId,
    });
    expect(deleteResponse.status).toBe(200);
    expect(bulkDeleteLibraryNodes).toHaveBeenCalledWith(ctx, { ids: [nodeId] });
  });

  it("maps service errors and rejects unauthenticated requests", async () => {
    vi.mocked(createWorkspaceNode).mockRejectedValue(
      new ServiceError("conflict", "That workspace already exists."),
    );
    const conflictResponse = await POST(
      request("nodes", { kind: "workspace", title: "Research" }),
    );

    vi.mocked(getRouteServiceContext).mockResolvedValue(null);
    const unauthorizedResponse = await bulkDelete(
      request("nodes/bulk-delete", { ids: [nodeId] }),
    );

    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toEqual({
      code: "conflict",
      error: "That workspace already exists.",
    });
    expect(unauthorizedResponse.status).toBe(401);
  });
});
