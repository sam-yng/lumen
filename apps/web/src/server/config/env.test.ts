import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "./env";

describe("env schema", () => {
  it("accepts a complete public env", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        NEXT_PUBLIC_APP_URL: "https://lumen.app",
      }),
    ).not.toThrow();
  });

  it("defaults the app url to localhost when unset", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }).NEXT_PUBLIC_APP_URL,
    ).toBe("http://localhost:3000");
  });

  it("rejects a non-url app url", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects server env missing the secret key", () => {
    expect(() =>
      parseServerEnv({
        PG_BOSS_DATABASE_URL: "postgresql://localhost:5432/postgres",
      }),
    ).toThrow();
  });

  it("keeps the diarization + sweep defaults", () => {
    const env = parseServerEnv({
      SUPABASE_SECRET_KEY: "sb_secret_x",
      PG_BOSS_DATABASE_URL: "postgresql://localhost:5432/postgres",
    });
    expect(env.DIARIZATION_ENABLED).toBe(false);
    expect(env.DIARIZATION_CLUSTER_THRESHOLD).toBe(0.9);
    expect(env.DIARIZATION_NUM_SPEAKERS).toBe(-1);
    expect(env.LIVE_SESSION_STALE_MINUTES).toBe(45);
  });
});
