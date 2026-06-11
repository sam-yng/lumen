import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ServiceSupabaseClient } from "@/server/services/context";
import type { DiarizationProvider } from "../diarization-provider";
import {
  type ProcessSpeakerLabelJobDeps,
  processSpeakerLabelJob,
} from "../speaker-label-worker";
import { TrackingSupabase } from "./tracking-supabase";

const USER_ID = "018f4ed6-30f2-7838-8b36-2464c4b59e2f";
const OTHER_USER_ID = "018f4ed6-30f2-7838-8b36-2464c4b59e30";
const RECORDING_ID = "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7";
const FILE_ID = "018f4ed8-0d34-73bd-8b71-307768d57b02";
const STORAGE_KEY = `${USER_ID}/file-seminar-webm`;
const TRANSCRIPT_ID = "018f4ed9-1111-7000-8000-000000000001";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
  tempDirs.length = 0;
});

async function fixture(input: {
  diarization?: DiarizationProvider;
  fileName?: string;
}) {
  const tempDir = await mkdtemp(join(tmpdir(), "lumen-label-"));
  tempDirs.push(tempDir);

  const supabase = new TrackingSupabase({
    files: [
      {
        id: FILE_ID,
        user_id: USER_ID,
        name: input.fileName ?? "seminar.webm",
        storage_key: STORAGE_KEY,
      },
    ],
    recordings: [
      {
        id: RECORDING_ID,
        user_id: USER_ID,
        file_id: FILE_ID,
        status: "done",
        error: null,
      },
    ],
    transcripts: [
      {
        id: TRANSCRIPT_ID,
        user_id: USER_ID,
        recording_id: RECORDING_ID,
      },
      {
        // A second user's transcript for the same-shaped data: scoping must
        // never let the job touch it.
        id: "018f4ed9-2222-7000-8000-000000000002",
        user_id: OTHER_USER_ID,
        recording_id: RECORDING_ID,
      },
    ],
    transcript_segments: [
      {
        id: "seg-1",
        transcript_id: TRANSCRIPT_ID,
        start_ms: 0,
        end_ms: 900,
        text: "Hello there.",
        speaker: null,
      },
      {
        id: "seg-2",
        transcript_id: TRANSCRIPT_ID,
        start_ms: 1_100,
        end_ms: 1_900,
        text: "General Kenobi.",
        speaker: null,
      },
      {
        id: "seg-other",
        transcript_id: "018f4ed9-2222-7000-8000-000000000002",
        start_ms: 0,
        end_ms: 900,
        text: "Other user's segment.",
        speaker: null,
      },
    ],
  });

  const convertCalls: string[][] = [];
  const deps: ProcessSpeakerLabelJobDeps = {
    bucket: "library-files",
    supabase: supabase as unknown as ServiceSupabaseClient,
    storage: {
      async download() {
        return {
          bytes: new TextEncoder().encode("fake audio"),
          contentType: "audio/webm",
        };
      },
      async upload() {},
      async remove() {},
    },
    diarization: input.diarization,
    tempDir,
    convertToWav: async (args) => {
      convertCalls.push(args);
      // The real runner produces the output WAV; the diarizer reads it.
      const outputPath = args[args.length - 1];
      if (outputPath) await writeFile(outputPath, "fake wav");
    },
  };

  return {
    supabase,
    deps,
    convertCalls,
    jobInput: {
      id: "job-1",
      name: "label-speakers",
      data: {
        userId: USER_ID,
        recordingId: RECORDING_ID,
        fileId: FILE_ID,
        storageKey: STORAGE_KEY,
        bucket: "library-files",
      },
    },
  };
}

describe("processSpeakerLabelJob", () => {
  it("converts the audio, diarizes, and updates the right user's segments", async () => {
    const { supabase, deps, convertCalls, jobInput } = await fixture({
      diarization: {
        async diarize(audioPath) {
          expect(audioPath).toMatch(/-label\.wav$/);
          expect(await readFile(audioPath, "utf8")).toBe("fake wav");
          return [
            { startMs: 0, endMs: 1_000, speaker: "Speaker 1" },
            { startMs: 1_000, endMs: 2_000, speaker: "Speaker 2" },
          ];
        },
      },
    });

    const result = await processSpeakerLabelJob(jobInput, deps);

    expect(result).toEqual({ recordingId: RECORDING_ID, labeled: 2 });
    expect(convertCalls).toHaveLength(1);
    expect(convertCalls[0]).toContain("-ar");
    expect(
      supabase.tables.transcript_segments.map((row) => row.speaker),
    ).toEqual(["Speaker 1", "Speaker 2", null]);

    // Every files/transcripts read is user_id-scoped (service-role caveat).
    const scopedReads = supabase.queries.filter(
      (query) =>
        ["files", "transcripts"].includes(query.table) &&
        query.inserted.length === 0,
    );
    expect(scopedReads.length).toBeGreaterThan(0);
    expect(
      scopedReads.every((query) =>
        query.filters.some(
          (filter) => filter.column === "user_id" && filter.value === USER_ID,
        ),
      ),
    ).toBe(true);

    // Segment updates are scoped to the owned transcript.
    const segmentUpdates = supabase.queries.filter(
      (query) => query.table === "transcript_segments" && query.updated,
    );
    expect(segmentUpdates).toHaveLength(2);
    expect(
      segmentUpdates.every((query) =>
        query.filters.some(
          (filter) =>
            filter.column === "transcript_id" && filter.value === TRANSCRIPT_ID,
        ),
      ),
    ).toBe(true);
  });

  it("leaves segments untouched and the recording done when diarization fails", async () => {
    const { supabase, deps, jobInput } = await fixture({
      diarization: {
        async diarize() {
          throw new Error("diarization exploded");
        },
      },
    });

    await expect(processSpeakerLabelJob(jobInput, deps)).rejects.toThrow(
      "diarization exploded",
    );

    expect(
      supabase.tables.transcript_segments.map((row) => row.speaker),
    ).toEqual([null, null, null]);
    expect(supabase.tables.recordings[0]).toMatchObject({
      status: "done",
      error: null,
    });
  });

  it("is a no-op when no diarization provider is configured", async () => {
    const { supabase, deps, convertCalls, jobInput } = await fixture({});

    const result = await processSpeakerLabelJob(jobInput, deps);

    expect(result).toEqual({ recordingId: RECORDING_ID, labeled: 0 });
    expect(convertCalls).toHaveLength(0);
    expect(
      supabase.tables.transcript_segments.every((row) => row.speaker === null),
    ).toBe(true);
  });

  it("updates nothing when diarization returns no turns", async () => {
    const { supabase, deps, jobInput } = await fixture({
      diarization: {
        async diarize() {
          return [];
        },
      },
    });

    const result = await processSpeakerLabelJob(jobInput, deps);

    expect(result).toEqual({ recordingId: RECORDING_ID, labeled: 0 });
    expect(
      supabase.queries.filter(
        (query) => query.table === "transcript_segments" && query.updated,
      ),
    ).toHaveLength(0);
  });

  it("skips conversion when the stored audio is already WAV", async () => {
    const { convertCalls, deps, jobInput } = await fixture({
      fileName: "seminar.wav",
      diarization: {
        async diarize(audioPath) {
          expect(await readFile(audioPath, "utf8")).toBe("fake audio");
          return [{ startMs: 0, endMs: 2_000, speaker: "Speaker 1" }];
        },
      },
    });

    await processSpeakerLabelJob(jobInput, deps);

    expect(convertCalls).toHaveLength(0);
  });

  it("refuses a job whose storage key does not match the file", async () => {
    const { deps, jobInput } = await fixture({
      diarization: {
        async diarize() {
          return [];
        },
      },
    });
    jobInput.data.storageKey = `${USER_ID}/some-other-key`;

    await expect(processSpeakerLabelJob(jobInput, deps)).rejects.toThrow(
      "Job storage key does not match file.",
    );
  });
});
