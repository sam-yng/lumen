import type { ServiceContext } from "@/server/services/context";
import { assertNoDatabaseError, ServiceError } from "@/server/services/errors";

/** Floor a unix-ms timestamp to its fixed window boundary. */
export function windowStart(nowMs: number, windowMs: number): number {
  return nowMs - (nowMs % windowMs);
}

type Limit = { action: string; max: number; windowMs: number };

type BumpRow = { new_count: number };

/**
 * Increment the caller's counter for `action` in the current fixed window and
 * throw a `rate_limited` ServiceError if it now exceeds `max`. Uses the
 * user-scoped service client, so the RPC's `auth.uid()` is the authenticated
 * user. The increment+check is atomic in `bump_rate_limit`.
 */
export async function enforceRateLimit(
  ctx: ServiceContext,
  limit: Limit,
  nowMs: number = Date.now(),
): Promise<void> {
  const start = new Date(windowStart(nowMs, limit.windowMs)).toISOString();
  const { data, error } = await ctx.supabase.rpc<BumpRow>("bump_rate_limit", {
    p_action: limit.action,
    p_window_start: start,
  });
  assertNoDatabaseError(error, "Rate limit check failed");

  const count = data[0]?.new_count ?? 0;
  if (count > limit.max) {
    throw new ServiceError(
      "rate_limited",
      `Rate limit exceeded for "${limit.action}". Try again shortly.`,
    );
  }
}

export const LIMITS = {
  transcriptionEnqueue: {
    action: "transcription_enqueue",
    max: 20,
    windowMs: 60 * 60 * 1000, // 20 transcriptions/hour/user
  },
  liveSessionStart: {
    action: "live_session_start",
    max: 10,
    windowMs: 60 * 60 * 1000, // 10 live sessions/hour/user
  },
} as const satisfies Record<string, Limit>;
