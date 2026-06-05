import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/config/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon-key",
  }),
}));

const createClient = vi.fn(() => ({ auth: {} }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("createTokenSupabase", () => {
  it("binds the bearer token via the Authorization header and anon key", async () => {
    const { createTokenSupabase } = await import("@/server/db/client");
    createTokenSupabase("jwt-123");

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      {
        global: { headers: { Authorization: "Bearer jwt-123" } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  });
});
