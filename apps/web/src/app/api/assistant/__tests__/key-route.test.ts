import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/library/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/library/http")>(
    "@/app/api/library/http",
  );
  return { ...actual, getRouteServiceContext: vi.fn() };
});
vi.mock("@/server/services/ai-credentials", () => ({
  hasApiKey: vi.fn(),
  saveApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));

import { DELETE, GET, PUT } from "@/app/api/assistant/key/route";
import { getRouteServiceContext } from "@/app/api/library/http";
import {
  deleteApiKey,
  hasApiKey,
  saveApiKey,
} from "@/server/services/ai-credentials";

const ctx = { userId: "user-1", supabase: {} } as never;

describe("assistant key route", () => {
  it("GET returns 401 when unauthenticated", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET reports whether a key is set", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const res = await GET();
    expect(await res.json()).toEqual({ hasKey: true });
  });

  it("PUT rejects an empty key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    const res = await PUT(
      new Request("http://x/api/assistant/key", {
        method: "PUT",
        body: JSON.stringify({ key: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT saves a valid key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(saveApiKey).mockResolvedValue();
    const res = await PUT(
      new Request("http://x/api/assistant/key", {
        method: "PUT",
        body: JSON.stringify({ key: "sk-ant-abc" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(saveApiKey).toHaveBeenCalledWith(ctx, "sk-ant-abc");
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
  });

  it("DELETE removes the key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(deleteApiKey).mockResolvedValue();
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(deleteApiKey).toHaveBeenCalledWith(ctx);
  });
});
