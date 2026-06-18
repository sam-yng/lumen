import { describe, expect, it } from "vitest";
import type { Tables } from "@/server/db/database.types";
import type { ServiceSupabaseClient } from "@/server/services/context";
import {
  isStaleLiveSession,
  STALE_LIVE_EXPIRED_ERROR,
  sweepStaleLiveSessions,
} from "../stale-live-sweeper";
import { TrackingSupabase } from "./tracking-supabase";

const USER_ID = "018f4ed6-30f2-7838-8b36-2464c4b59e2f";
const OTHER_USER_ID = "018f4ed6-30f2-7838-8b36-2464c4b59e30";
const RECORDING_ID = "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7";
const OTHER_RECORDING_ID = "018f4ed7-47c4-7583-8207-1e5ce4d0a2a8";
const NODE_ID = "018f4ed8-0d34-73bd-8b71-307768d57b02";
const TRANSCRIPT_ID = "018f4ed9-1111-7000-8000-000000000001";
const OTHER_TRANSCRIPT_ID = "018f4ed9-2222-7000-8000-000000000002";

const NOW = new Date("2026-06-12T12:00:00Z");
const STALE_MINUTES = 45;

function recordingRow(
  overrides: Partial<Tables<"recordings">> = {},
): Tables<"recordings"> {
  return {
    id: RECORDING_ID,
    user_id: USER_ID,
    node_id: NODE_ID,
    status: "live",
    duration_sec: null,
    error: null,
    created_at: minutesAgo(120),
    ...overrides,
  };
}

function minutesAgo(minutes: number) {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("isStaleLiveSession", () => {
  it("is fresh while the newest segment is inside the threshold", () => {
    expect(
      isStaleLiveSession({
        recordingCreatedAt: minutesAgo(120),
        newestSegmentCreatedAt: minutesAgo(10),
        now: NOW,
        staleAfterMinutes: STALE_MINUTES,
      }),
    ).toBe(false);
  });

  it("is stale once the newest segment falls outside the threshold", () => {
    expect(
      isStaleLiveSession({
        recordingCreatedAt: minutesAgo(120),
        newestSegmentCreatedAt: minutesAgo(46),
        now: NOW,
        staleAfterMinutes: STALE_MINUTES,
      }),
    ).toBe(true);
  });

  it("is not stale exactly at the threshold boundary", () => {
    expect(
      isStaleLiveSession({
        recordingCreatedAt: minutesAgo(120),
        newestSegmentCreatedAt: minutesAgo(45),
        now: NOW,
        staleAfterMinutes: STALE_MINUTES,
      }),
    ).toBe(false);
  });

  it("falls back to the recording creation time when no segments exist", () => {
    expect(
      isStaleLiveSession({
        recordingCreatedAt: minutesAgo(46),
        newestSegmentCreatedAt: null,
        now: NOW,
        staleAfterMinutes: STALE_MINUTES,
      }),
    ).toBe(true);
    expect(
      isStaleLiveSession({
        recordingCreatedAt: minutesAgo(10),
        newestSegmentCreatedAt: null,
        now: NOW,
        staleAfterMinutes: STALE_MINUTES,
      }),
    ).toBe(false);
  });
});

function fixture(input: {
  recordingCreatedAt: string;
  segments: Array<{ created_at: string; text: string }>;
}) {
  return new TrackingSupabase({
    recordings: [
      recordingRow({
        created_at: input.recordingCreatedAt,
      }),
    ],
    transcripts: [
      {
        id: TRANSCRIPT_ID,
        user_id: USER_ID,
        recording_id: RECORDING_ID,
        full_text: "",
        language: null,
      },
    ],
    transcript_segments: input.segments.map((segment, index) => ({
      id: `seg-${index}`,
      transcript_id: TRANSCRIPT_ID,
      start_ms: index * 1_000,
      end_ms: index * 1_000 + 900,
      text: segment.text,
      speaker: null,
      created_at: segment.created_at,
    })),
  });
}

function sweep(supabase: TrackingSupabase) {
  return sweepStaleLiveSessions({
    supabase: supabase as unknown as ServiceSupabaseClient,
    staleAfterMinutes: STALE_MINUTES,
    now: () => NOW,
  });
}

describe("sweepStaleLiveSessions", () => {
  it("finalizes a stale session from its stored segments", async () => {
    const supabase = fixture({
      recordingCreatedAt: minutesAgo(120),
      segments: [
        { created_at: minutesAgo(80), text: "Hello there." },
        { created_at: minutesAgo(70), text: "General Kenobi." },
      ],
    });

    const result = await sweep(supabase);

    expect(result).toMatchObject({ checked: 1, finalized: 1, expired: 0 });
    expect(supabase.tables.recordings[0]).toMatchObject({
      status: "done",
      error: null,
      duration_sec: 2,
    });
    expect(supabase.tables.transcripts).toHaveLength(1);
    expect(supabase.tables.transcripts[0]).toMatchObject({
      user_id: USER_ID,
      recording_id: RECORDING_ID,
      full_text: "Hello there. General Kenobi.",
      language: null,
    });
    // The fake has no FK cascade, so only count segments attached to the
    // rewritten transcript (the old transcript's rows cascade away in real
    // Postgres).
    const rewritten = supabase.tables.transcript_segments.filter(
      (row) => row.transcript_id === supabase.tables.transcripts[0]?.id,
    );
    expect(rewritten).toHaveLength(2);
    expect(rewritten[0]).toMatchObject({ text: "Hello there." });
  });

  it("expires a stale session with no segments", async () => {
    const supabase = fixture({
      recordingCreatedAt: minutesAgo(120),
      segments: [],
    });

    const result = await sweep(supabase);

    expect(result).toMatchObject({ checked: 1, finalized: 0, expired: 1 });
    expect(supabase.tables.recordings[0]).toMatchObject({
      status: "failed",
      error: STALE_LIVE_EXPIRED_ERROR,
    });
  });

  it("leaves fresh live sessions untouched", async () => {
    const supabase = fixture({
      recordingCreatedAt: minutesAgo(120),
      segments: [{ created_at: minutesAgo(5), text: "Still talking." }],
    });

    const result = await sweep(supabase);

    expect(result).toMatchObject({ checked: 1, finalized: 0, expired: 0 });
    expect(supabase.tables.recordings[0]).toMatchObject({ status: "live" });
    expect(supabase.tables.transcripts[0]).toMatchObject({ full_text: "" });
    const recordingWrites = supabase.queries.filter(
      (query) => query.table === "recordings" && query.updated !== null,
    );
    expect(recordingWrites).toHaveLength(0);
  });

  it("scopes every write by the owning user_id across users", async () => {
    const supabase = new TrackingSupabase({
      recordings: [
        recordingRow({
          created_at: minutesAgo(120),
        }),
        recordingRow({
          id: OTHER_RECORDING_ID,
          user_id: OTHER_USER_ID,
          node_id: "018f4ed8-0d34-73bd-8b71-307768d57b03",
          created_at: minutesAgo(120),
        }),
      ],
      transcripts: [
        {
          id: TRANSCRIPT_ID,
          user_id: USER_ID,
          recording_id: RECORDING_ID,
          full_text: "",
          language: null,
        },
        {
          id: OTHER_TRANSCRIPT_ID,
          user_id: OTHER_USER_ID,
          recording_id: OTHER_RECORDING_ID,
          full_text: "",
          language: null,
        },
      ],
      transcript_segments: [
        {
          id: "seg-owned",
          transcript_id: TRANSCRIPT_ID,
          start_ms: 0,
          end_ms: 900,
          text: "Owned segment.",
          speaker: null,
          created_at: minutesAgo(80),
        },
      ],
    });

    const result = await sweep(supabase);

    // User A has content → finalized; user B is a husk → expired.
    expect(result).toMatchObject({ checked: 2, finalized: 1, expired: 1 });
    expect(
      supabase.tables.recordings.find((row) => row.id === RECORDING_ID),
    ).toMatchObject({ status: "done" });
    expect(
      supabase.tables.recordings.find((row) => row.id === OTHER_RECORDING_ID),
    ).toMatchObject({ status: "failed", error: STALE_LIVE_EXPIRED_ERROR });

    // Every per-recording read/write on user-scoped tables carries the
    // owning user's id (service-role caveat — docs/SECURITY.md). The only
    // unscoped query is the initial status='live' scan.
    const scopedQueries = supabase.queries.filter(
      (query) =>
        ["recordings", "transcripts"].includes(query.table) &&
        query.inserted.length === 0 &&
        !query.filters.some(
          (filter) => filter.column === "status" && filter.value === "live",
        ),
    );
    expect(scopedQueries.length).toBeGreaterThan(0);
    for (const query of scopedQueries) {
      const userFilter = query.filters.find(
        (filter) => filter.column === "user_id",
      );
      expect(userFilter).toBeDefined();
      expect([USER_ID, OTHER_USER_ID]).toContain(userFilter?.value);
    }
    // Inserted rows belong to their owners.
    const insertedTranscripts = supabase.queries
      .filter((query) => query.table === "transcripts")
      .flatMap((query) => query.inserted);
    expect(insertedTranscripts).toHaveLength(1);
    expect(insertedTranscripts[0]).toMatchObject({ user_id: USER_ID });
  });

  it("continues sweeping when one recording fails", async () => {
    const supabase = fixture({
      recordingCreatedAt: minutesAgo(120),
      segments: [],
    });
    // A second stale husk for another user, listed first so its failure
    // would mask the first user's sweep if errors were not contained.
    supabase.tables.recordings.unshift(
      recordingRow({
        id: OTHER_RECORDING_ID,
        user_id: OTHER_USER_ID,
        node_id: "018f4ed8-0d34-73bd-8b71-307768d57b03",
        // Unparseable timestamp forces a per-recording error.
        created_at: "not-a-timestamp",
      }),
    );

    const result = await sweep(supabase);

    expect(result.checked).toBe(2);
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(
      supabase.tables.recordings.find((row) => row.id === RECORDING_ID),
    ).toMatchObject({ status: "failed", error: STALE_LIVE_EXPIRED_ERROR });
  });
});
