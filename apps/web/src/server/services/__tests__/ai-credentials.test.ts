import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import {
  deleteApiKey,
  getDecryptedApiKey,
  hasApiKey,
  saveApiKey,
} from "@/server/services/ai-credentials";

describe("ai-credentials", () => {
  it("saveApiKey calls set_ai_api_key with the key", async () => {
    const ctx = createContext({});
    await saveApiKey(ctx, "sk-ant-123");
    const supabase = ctx.supabase as unknown as {
      rpcLog: { fn: string; args: Record<string, unknown> }[];
    };
    expect(supabase.rpcLog).toEqual([
      { fn: "set_ai_api_key", args: { p_key: "sk-ant-123" } },
    ]);
  });

  it("hasApiKey is true only when a row exists", async () => {
    const withKey = createContext({
      user_ai_credentials: [{ user_id: "user-1", vault_secret_id: "s1" }],
    });
    const without = createContext({ user_ai_credentials: [] });
    expect(await hasApiKey(withKey)).toBe(true);
    expect(await hasApiKey(without)).toBe(false);
  });

  it("hasApiKey is scoped to the user", async () => {
    const ctx = createContext({
      user_ai_credentials: [{ user_id: "user-2", vault_secret_id: "s9" }],
    });
    expect(await hasApiKey(ctx)).toBe(false);
  });

  it("getDecryptedApiKey returns the key from get_ai_api_key", async () => {
    const ctx = createContext(
      {},
      { get_ai_api_key: [{ api_key: "sk-ant-xyz" }] },
    );
    expect(await getDecryptedApiKey(ctx)).toBe("sk-ant-xyz");
  });

  it("getDecryptedApiKey returns null when unset", async () => {
    const ctx = createContext({}, { get_ai_api_key: [] });
    expect(await getDecryptedApiKey(ctx)).toBeNull();
  });

  it("deleteApiKey calls delete_ai_api_key", async () => {
    const ctx = createContext({});
    await deleteApiKey(ctx);
    const supabase = ctx.supabase as unknown as { rpcLog: { fn: string }[] };
    expect(supabase.rpcLog.at(-1)?.fn).toBe("delete_ai_api_key");
  });
});
