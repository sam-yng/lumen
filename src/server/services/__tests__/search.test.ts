import { describe, expect, it } from "vitest";
import { buildSnippet, rankResults } from "@/server/services/search";

function doc(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    user_id: "user-1",
    folder_id: null,
    title: "Biology notes",
    content_json: null,
    content_text: "The mitochondria is the powerhouse of the cell.",
    content_tsv: null as unknown,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("buildSnippet", () => {
  it("windows around the first query term", () => {
    const snippet = buildSnippet(
      "alpha beta gamma mitochondria delta epsilon",
      "mitochondria",
    );
    expect(snippet).toContain("mitochondria");
  });

  it("falls back to the head when the term is absent", () => {
    expect(buildSnippet("short text", "absent")).toBe("short text");
  });

  it("returns empty string for empty source", () => {
    expect(buildSnippet(null, "x")).toBe("");
  });
});

describe("rankResults", () => {
  it("ranks body hits (tier 0) above name-only hits (tier 1)", () => {
    const results = rankResults({
      query: "cell",
      documentBodyHits: [doc({ id: "body" })],
      transcriptHits: [],
      documentTitleHits: [],
      fileNameHits: [
        {
          id: "f1",
          user_id: "user-1",
          folder_id: null,
          name: "cell-diagram.png",
          mime_type: "image/png",
          size_bytes: 1,
          storage_key: "k",
          kind: "other",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    expect(results.map((r) => r.kind)).toEqual(["document", "file"]);
    expect(results[0].tier).toBe(0);
    expect(results[1].tier).toBe(1);
  });

  it("dedupes a document matching both body and title into one tier-0 hit", () => {
    const results = rankResults({
      query: "biology",
      documentBodyHits: [doc({ id: "same" })],
      transcriptHits: [],
      documentTitleHits: [doc({ id: "same" })],
      fileNameHits: [],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "document", id: "same", tier: 0 });
  });

  it("includes transcript hits at tier 0 with a snippet", () => {
    const results = rankResults({
      query: "lecture",
      documentBodyHits: [],
      transcriptHits: [
        {
          id: "t1",
          user_id: "user-1",
          recording_id: "r1",
          full_text: "today's lecture covers cells",
          full_text_tsv: null as unknown,
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      documentTitleHits: [],
      fileNameHits: [],
    });
    expect(results[0]).toMatchObject({
      kind: "transcript",
      recordingId: "r1",
      tier: 0,
    });
    expect((results[0] as { snippet: string }).snippet).toContain("lecture");
  });
});
