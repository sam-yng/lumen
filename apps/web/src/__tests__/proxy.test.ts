import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/server/config/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon-key",
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

import { proxy } from "@/proxy";

function request(path: string) {
  return new NextRequest(new URL(`http://localhost${path}`));
}

describe("proxy auth guard", () => {
  beforeEach(() => {
    state.user = null;
  });

  it("does not redirect /api/mcp when unauthenticated (route does its own bearer auth)", async () => {
    const response = await proxy(request("/api/mcp"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a protected route to /login when unauthenticated", async () => {
    const response = await proxy(request("/library"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("does not let a sibling prefix (/api/mcp-evil) inherit the public exemption", async () => {
    const response = await proxy(request("/api/mcp-evil"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects an authenticated user from an auth page to the root", async () => {
    state.user = { id: "user-1" };
    const response = await proxy(request("/login"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
