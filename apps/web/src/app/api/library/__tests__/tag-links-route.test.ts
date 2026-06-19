import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/library/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/library/http")>(
    "@/app/api/library/http",
  );
  return { ...actual, getRouteServiceContext: vi.fn() };
});
vi.mock("@/server/services/tags", () => ({
  setTagOnNodes: vi.fn(),
}));

import { getRouteServiceContext } from "@/app/api/library/http";
import { POST } from "@/app/api/library/tag-links/bulk/route";
import { setTagOnNodes } from "@/server/services/tags";

const ctx = { userId: "user-1", supabase: {} } as never;
const tagId = "11111111-1111-4111-8111-111111111111";
const nodeId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new Request("http://x/api/library/tag-links/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("bulk tag-links route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
  });

  it("validates and dispatches a bulk desired-state request", async () => {
    vi.mocked(setTagOnNodes).mockResolvedValue([]);

    const response = await POST(
      request({ tagId, nodeIds: [nodeId], linked: true }),
    );

    expect(response.status).toBe(200);
    expect(setTagOnNodes).toHaveBeenCalledWith(ctx, {
      tagId,
      nodeIds: [nodeId],
      linked: true,
    });
    expect(await response.json()).toEqual([]);
  });

  it("rejects empty selections before calling the service", async () => {
    const response = await POST(request({ tagId, nodeIds: [], linked: false }));

    expect(response.status).toBe(400);
    expect(setTagOnNodes).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(null);

    const response = await POST(
      request({ tagId, nodeIds: [nodeId], linked: true }),
    );

    expect(response.status).toBe(401);
    expect(setTagOnNodes).not.toHaveBeenCalled();
  });
});
