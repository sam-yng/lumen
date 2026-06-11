import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/library/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/library/http")>(
    "@/app/api/library/http",
  );
  return { ...actual, getRouteServiceContext: vi.fn() };
});
vi.mock("@/server/services/ai-credentials", () => ({
  getDecryptedApiKey: vi.fn(),
}));
vi.mock("@/server/services/assistant", () => ({
  runAssistant: vi.fn(),
  anthropicForKey: vi.fn(() => ({})),
}));

import { POST } from "@/app/api/assistant/route";
import { getRouteServiceContext } from "@/app/api/library/http";
import { getDecryptedApiKey } from "@/server/services/ai-credentials";
import { runAssistant } from "@/server/services/assistant";

const ctx = { userId: "user-1", supabase: {} } as never;
function req(body: unknown) {
  return new Request("http://x/api/assistant", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("assistant route", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(null);
    expect((await POST(req({ messages: [] }))).status).toBe(401);
  });

  it("returns no_api_key when the user has no key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue(null);
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(await res.json()).toEqual({ state: "no_api_key" });
  });

  it("runs the assistant and returns the answer", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-ant-1");
    vi.mocked(runAssistant).mockResolvedValue({
      message: "done",
      toolCalls: [],
      stoppedAtCap: false,
      sources: [],
    });
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(await res.json()).toEqual({
      state: "ok",
      message: "done",
      toolCalls: [],
      stoppedAtCap: false,
      sources: [],
    });
  });

  it("maps an invalid key to invalid_key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-bad");
    vi.mocked(runAssistant).mockRejectedValue(
      Object.assign(new Error("auth"), { status: 401 }),
    );
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(await res.json()).toEqual({ state: "invalid_key" });
  });

  it("maps a forbidden key to invalid_key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-bad");
    vi.mocked(runAssistant).mockRejectedValue(
      Object.assign(new Error("forbidden"), { status: 403 }),
    );
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(await res.json()).toEqual({ state: "invalid_key" });
  });

  it("maps a rate limit to rate_limited", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-ant-1");
    vi.mocked(runAssistant).mockRejectedValue(
      Object.assign(new Error("rate"), { status: 429 }),
    );
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(await res.json()).toEqual({ state: "rate_limited" });
  });

  it("maps an unexpected failure to error", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-ant-1");
    vi.mocked(runAssistant).mockRejectedValue(new Error("boom"));
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(await res.json()).toEqual({ state: "error" });
  });

  it("rejects an over-long message body", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    const res = await POST(
      req({ messages: [{ role: "user", content: "x".repeat(10_001) }] }),
    );
    expect(res.status).toBe(400);
  });
});
