import { describe, expect, it, vi } from "vitest";
import { getMcpServiceContext } from "@/server/mcp/auth";

function req(headers: Record<string, string> = {}) {
  return new Request("https://x/api/mcp", { method: "POST", headers });
}

describe("getMcpServiceContext", () => {
  it("returns null when the Authorization header is missing", async () => {
    const ctx = await getMcpServiceContext(req(), { resolveUser: vi.fn() });
    expect(ctx).toBeNull();
  });

  it("returns null when the scheme is not Bearer", async () => {
    const resolveUser = vi.fn();
    const ctx = await getMcpServiceContext(
      req({ Authorization: "Basic abc" }),
      {
        resolveUser,
      },
    );
    expect(ctx).toBeNull();
    expect(resolveUser).not.toHaveBeenCalled();
  });

  it("returns null when the token does not resolve to a user", async () => {
    const ctx = await getMcpServiceContext(
      req({ Authorization: "Bearer bad" }),
      { resolveUser: async () => null },
    );
    expect(ctx).toBeNull();
  });

  it("builds a ServiceContext for a valid token", async () => {
    const supabase = { from: vi.fn() } as never;
    const ctx = await getMcpServiceContext(
      req({ Authorization: "Bearer good" }),
      { resolveUser: async () => ({ userId: "user-1", supabase }) },
    );
    expect(ctx).toEqual({ userId: "user-1", supabase });
  });
});
