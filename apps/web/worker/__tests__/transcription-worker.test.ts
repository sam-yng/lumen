import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from "@/server/services/embedding-provider";
import type { DiarizationProvider } from "../diarization-provider";
import type { TranscriptionProvider } from "../transcription-provider";
import {
  processTranscriptionJob,
  type WorkerSupabaseClient,
} from "../transcription-worker";

type Row = Record<string, unknown>;

class TrackingQuery {
  filters: Array<{ column: string; value: unknown }> = [];
  inserted: Row[] = [];
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;
  private orderBy: string | null = null;

  constructor(
    readonly table: string,
    private readonly rows: Row[],
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string) {
    this.orderBy = column;
    return this;
  }

  insert(values: Row | Row[]) {
    const insertedRows = Array.isArray(values) ? values : [values];
    this.inserted.push(...insertedRows);
    this.rows.push(...insertedRows);
    return this;
  }

  update(values: Row) {
    this.pendingUpdate = values;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  async single() {
    const matchingRows = this.applyFilters(this.rows);
    if (this.pendingUpdate) {
      for (const row of matchingRows) Object.assign(row, this.pendingUpdate);
    }
    if (this.pendingDelete) this.deleteRows(matchingRows);
    return { data: matchingRows[0] ?? null, error: null };
  }

  async maybeSingle() {
    return this.single();
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable; the fake mirrors that contract.
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Row[];
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const matchingRows = this.applyFilters(this.rows);
    if (this.pendingUpdate) {
      for (const row of matchingRows) Object.assign(row, this.pendingUpdate);
    }
    if (this.pendingDelete) this.deleteRows(matchingRows);

    return Promise.resolve({
      data: matchingRows,
      error: null,
    }).then(onfulfilled, onrejected);
  }

  private applyFilters(rows: Row[]) {
    let result = rows.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value),
    );

    if (this.orderBy) {
      result = [...result].sort(
        (a, b) => Number(a[this.orderBy ?? ""]) - Number(b[this.orderBy ?? ""]),
      );
    }

    return result;
  }

  private deleteRows(rows: Row[]) {
    for (const row of rows) {
      const index = this.rows.indexOf(row);
      if (index >= 0) this.rows.splice(index, 1);
    }
  }
}

class TrackingSupabase {
  readonly queries: TrackingQuery[] = [];

  constructor(readonly tables: Record<string, Row[]>) {}

  from(table: string) {
    const query = new TrackingQuery(table, this.tables[table] ?? []);
    this.queries.push(query);
    return query;
  }
}

function vector(value: number) {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) =>
    index === 0 ? value : 0,
  );
}

function embeddingProvider(vectors: number[][]) {
  const calls: string[][] = [];
  const provider: EmbeddingProvider = {
    async embed(texts: string[]) {
      calls.push(texts);
      return vectors.slice(0, texts.length);
    },
  };

  return { calls, provider };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
  tempDirs.length = 0;
});

describe("processTranscriptionJob", () => {
  it("downloads audio, transcribes it, writes transcript rows, and scopes worker queries", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "lumen-worker-"));
    tempDirs.push(tempDir);
    const supabase = new TrackingSupabase({
      files: [
        {
          id: "018f4ed8-0d34-73bd-8b71-307768d57b02",
          user_id: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
          name: "lecture.mp3",
          storage_key: "018f4ed6-30f2-7838-8b36-2464c4b59e2f/file-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7",
          user_id: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
          file_id: "018f4ed8-0d34-73bd-8b71-307768d57b02",
          status: "pending",
          error: null,
        },
      ],
      transcripts: [],
      transcript_segments: [],
      semantic_search_chunks: [],
    });
    const provider: TranscriptionProvider = {
      async transcribe(audioPath) {
        expect(audioPath).toMatch(/018f4ed7-47c4-7583-8207-1e5ce4d0a2a7\.mp3$/);
        expect(await readFile(audioPath, "utf8")).toBe("fake audio");
        return {
          fullText: "Hello world",
          language: "en",
          segments: [
            { startMs: 0, endMs: 900, text: "Hello world", speaker: null },
          ],
        };
      },
    };
    const { calls: embeddingCalls, provider: semanticProvider } =
      embeddingProvider([vector(0.5)]);

    await processTranscriptionJob(
      {
        id: "job-1",
        name: "transcribe-recording",
        data: {
          userId: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
          recordingId: "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7",
          fileId: "018f4ed8-0d34-73bd-8b71-307768d57b02",
          storageKey: "018f4ed6-30f2-7838-8b36-2464c4b59e2f/file-lecture-mp3",
          bucket: "library-files",
        },
      },
      {
        bucket: "library-files",
        supabase: supabase as unknown as WorkerSupabaseClient,
        storage: {
          async download() {
            return {
              bytes: new TextEncoder().encode("fake audio"),
              contentType: "audio/mpeg",
            };
          },
          async upload() {},
          async remove() {},
        },
        provider,
        embeddingProvider: semanticProvider,
        tempDir,
      },
    );

    expect(supabase.tables.recordings[0]).toMatchObject({
      status: "done",
      error: null,
      duration_sec: 1,
    });
    expect(supabase.tables.transcripts).toHaveLength(1);
    expect(supabase.tables.transcript_segments).toHaveLength(1);
    const userScopedQueries = supabase.queries.filter(
      (query) =>
        ["recordings", "files", "transcripts"].includes(query.table) &&
        query.inserted.length === 0,
    );
    expect(
      userScopedQueries.every((query) =>
        query.filters.some(
          (filter) =>
            filter.column === "user_id" &&
            filter.value === "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
        ),
      ),
    ).toBe(true);
    expect(
      supabase.queries.find(
        (query) => query.table === "transcripts" && query.inserted.length > 0,
      )?.inserted[0],
    ).toMatchObject({
      user_id: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
    });
    expect(supabase.tables.transcript_segments[0]).toMatchObject({
      transcript_id: supabase.tables.transcripts[0]?.id,
    });
    expect(embeddingCalls).toEqual([["Hello world"]]);
    expect(supabase.tables.semantic_search_chunks[0]).toMatchObject({
      user_id: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
      source_type: "transcript",
      transcript_id: supabase.tables.transcripts[0]?.id,
      recording_id: "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7",
      start_ms: 0,
      end_ms: 900,
      content: "Hello world",
      embedding: `[${vector(0.5).join(",")}]`,
    });
    const chunkDelete = supabase.queries.find(
      (query) =>
        query.table === "semantic_search_chunks" && query.inserted.length === 0,
    );
    expect(chunkDelete?.filters).toEqual(
      expect.arrayContaining([
        {
          column: "user_id",
          value: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
        },
        { column: "source_type", value: "transcript" },
        {
          column: "transcript_id",
          value: supabase.tables.transcripts[0]?.id,
        },
      ]),
    );
  });

  it("labels segments with speakers from the diarization provider", async () => {
    const { supabase, deps, jobInput } = await diarizationFixture({
      async diarize(audioPath) {
        expect(audioPath).toMatch(/018f4ed7-47c4-7583-8207-1e5ce4d0a2a7\.mp3$/);
        return [
          { startMs: 0, endMs: 1_000, speaker: "Speaker 1" },
          { startMs: 1_000, endMs: 2_000, speaker: "Speaker 2" },
        ];
      },
    });

    await processTranscriptionJob(jobInput, deps);

    expect(supabase.tables.recordings[0]).toMatchObject({ status: "done" });
    expect(
      supabase.tables.transcript_segments.map((row) => row.speaker),
    ).toEqual(["Speaker 1", "Speaker 2"]);
  });

  it("diarizes before transcription so providers that delete the audio cannot starve it", async () => {
    // The real Whisper provider removes its WAV input after transcribing.
    const order: string[] = [];
    const { deps, jobInput } = await diarizationFixture({
      async diarize(audioPath) {
        expect(await readFile(audioPath, "utf8")).toBe("fake audio");
        order.push("diarize");
        return [];
      },
    });
    const inner = deps.provider;
    deps.provider = {
      async transcribe(audioPath) {
        order.push("transcribe");
        const result = await inner.transcribe(audioPath);
        await rm(audioPath, { force: true });
        return result;
      },
    };

    await processTranscriptionJob(jobInput, deps);

    expect(order).toEqual(["diarize", "transcribe"]);
  });

  it("completes the job with null speakers when diarization fails", async () => {
    const { supabase, deps, jobInput } = await diarizationFixture({
      async diarize() {
        throw new Error("diarization exploded");
      },
    });

    await processTranscriptionJob(jobInput, deps);

    expect(supabase.tables.recordings[0]).toMatchObject({
      status: "done",
      error: null,
    });
    expect(
      supabase.tables.transcript_segments.map((row) => row.speaker),
    ).toEqual([null, null]);
  });
});

async function diarizationFixture(diarization: DiarizationProvider) {
  const tempDir = await mkdtemp(join(tmpdir(), "lumen-worker-"));
  tempDirs.push(tempDir);

  const supabase = new TrackingSupabase({
    files: [
      {
        id: "018f4ed8-0d34-73bd-8b71-307768d57b02",
        user_id: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
        name: "lecture.mp3",
        storage_key: "018f4ed6-30f2-7838-8b36-2464c4b59e2f/file-lecture-mp3",
      },
    ],
    recordings: [
      {
        id: "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7",
        user_id: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
        file_id: "018f4ed8-0d34-73bd-8b71-307768d57b02",
        status: "pending",
        error: null,
      },
    ],
    transcripts: [],
    transcript_segments: [],
    semantic_search_chunks: [],
  });

  const provider: TranscriptionProvider = {
    async transcribe() {
      return {
        fullText: "Hello there. General Kenobi.",
        language: "en",
        segments: [
          { startMs: 0, endMs: 900, text: "Hello there.", speaker: null },
          {
            startMs: 1_100,
            endMs: 1_900,
            text: "General Kenobi.",
            speaker: null,
          },
        ],
      };
    },
  };

  return {
    supabase,
    jobInput: {
      id: "job-1",
      name: "transcribe-recording",
      data: {
        userId: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
        recordingId: "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7",
        fileId: "018f4ed8-0d34-73bd-8b71-307768d57b02",
        storageKey: "018f4ed6-30f2-7838-8b36-2464c4b59e2f/file-lecture-mp3",
        bucket: "library-files",
      },
    },
    deps: {
      bucket: "library-files",
      supabase: supabase as unknown as WorkerSupabaseClient,
      storage: {
        async download() {
          return {
            bytes: new TextEncoder().encode("fake audio"),
            contentType: "audio/mpeg",
          };
        },
        async upload() {},
        async remove() {},
      },
      provider,
      diarization,
      tempDir,
    },
  };
}
