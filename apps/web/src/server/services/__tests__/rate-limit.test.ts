import { describe, expect, it } from "vitest";
import { ServiceError } from "../errors";
import { enforceRateLimit, LIMITS, windowStart } from "../rate-limit";
import { createContext } from "./fake-supabase";

describe("windowStart", () => {
  it("floors a timestamp to the window boundary", () => {
    const ts = new Date("2026-06-04T12:34:56.000Z").getTime();
    const start = windowStart(ts, 60_000);
    expect(new Date(start).toISOString()).toBe("2026-06-04T12:34:00.000Z");
  });

  it("keeps two timestamps in the same minute in one window", () => {
    const a = windowStart(Date.parse("2026-06-04T12:34:01Z"), 60_000);
    const b = windowStart(Date.parse("2026-06-04T12:34:59Z"), 60_000);
    expect(a).toBe(b);
  });
});

describe("enforceRateLimit", () => {
  const limit = { action: "test_action", max: 3, windowMs: 60_000 };

  it("passes when the bumped count is within the cap", async () => {
    const ctx = createContext({}, { bump_rate_limit: [{ new_count: 3 }] });
    await expect(enforceRateLimit(ctx, limit)).resolves.toBeUndefined();
  });

  it("throws a rate_limited ServiceError when the cap is exceeded", async () => {
    const ctx = createContext({}, { bump_rate_limit: [{ new_count: 4 }] });
    await expect(enforceRateLimit(ctx, limit)).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("calls bump_rate_limit with the action and floored window", async () => {
    const ctx = createContext({}, { bump_rate_limit: [{ new_count: 1 }] });
    const fake = ctx.supabase as unknown as {
      rpcLog: Array<{ fn: string; args: Record<string, unknown> }>;
    };
    await enforceRateLimit(ctx, limit, Date.parse("2026-06-04T12:34:30Z"));
    expect(fake.rpcLog[0]?.fn).toBe("bump_rate_limit");
    expect(fake.rpcLog[0]?.args).toMatchObject({
      p_action: "test_action",
      p_window_start: "2026-06-04T12:34:00.000Z",
    });
  });

  it("exposes a transcription enqueue and live-session start limit", () => {
    expect(LIMITS.transcriptionEnqueue.action).toBe("transcription_enqueue");
    expect(LIMITS.liveSessionStart.action).toBe("live_session_start");
    expect(ServiceError).toBeDefined();
  });
});
