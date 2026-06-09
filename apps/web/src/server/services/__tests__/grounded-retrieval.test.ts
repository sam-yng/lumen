import { describe, expect, it } from "vitest";
import {
  assignCitationLabels,
  chooseBestTranscriptSegment,
  type GroundedCandidate,
  parseGroundedSemanticRows,
} from "@/server/services/grounded-retrieval";

function docCandidate(over: Partial<GroundedCandidate> = {}): GroundedCandidate {
  return {
    kind: "document",
    title: "Biology notes",
    snippet: "mitochondria",
    score: 0.9,
    source: { documentId: "d1" },
    ...over,
  };
}

describe("assignCitationLabels", () => {
  it("assigns sequential S# labels starting at S1", () => {
    const labeled = assignCitationLabels([
      docCandidate({ source: { documentId: "d1" } }),
      docCandidate({ source: { documentId: "d2" } }),
      docCandidate({ source: { documentId: "d3" } }),
    ]);
    expect(labeled.map((s) => s.citationId)).toEqual(["S1", "S2", "S3"]);
    expect(labeled[0]).toMatchObject({
      kind: "document",
      title: "Biology notes",
    });
  });

  it("returns an empty array for no candidates", () => {
    expect(assignCitationLabels([])).toEqual([]);
  });
});

describe("chooseBestTranscriptSegment", () => {
  const segments = [
    { id: "seg-a", startMs: 0, endMs: 1000 },
    { id: "seg-b", startMs: 900, endMs: 2000 },
    { id: "seg-c", startMs: 5000, endMs: 6000 },
  ];

  it("chooses the segment with the largest overlap", () => {
    // chunk 800..1900 overlaps seg-a by 200, seg-b by 1000 -> seg-b
    expect(
      chooseBestTranscriptSegment({ startMs: 800, endMs: 1900 }, segments),
    ).toBe("seg-b");
  });

  it("breaks ties by earliest start_ms", () => {
    const tied = [
      { id: "late", startMs: 100, endMs: 200 },
      { id: "early", startMs: 0, endMs: 100 },
    ];
    // chunk 0..200 overlaps each by 100; earliest start wins
    expect(chooseBestTranscriptSegment({ startMs: 0, endMs: 200 }, tied)).toBe(
      "early",
    );
  });

  it("counts a touching boundary as an overlap when nothing better exists", () => {
    // chunk 1000..1000 only touches seg-a's end (overlap 0) -> still resolves
    expect(
      chooseBestTranscriptSegment({ startMs: 1000, endMs: 1000 }, [segments[0]]),
    ).toBe("seg-a");
  });

  it("returns null when no segment overlaps", () => {
    expect(
      chooseBestTranscriptSegment({ startMs: 3000, endMs: 4000 }, segments),
    ).toBeNull();
  });

  it("returns null for an empty segment list", () => {
    expect(chooseBestTranscriptSegment({ startMs: 0, endMs: 10 }, [])).toBeNull();
  });
});

describe("parseGroundedSemanticRows", () => {
  it("keeps document and transcript metadata, dropping malformed rows", () => {
    const parsed = parseGroundedSemanticRows([
      {
        id: "c1",
        user_id: "user-1",
        source_type: "document",
        source: { documentId: "d1" },
        chunk_index: 0,
        content: "doc chunk",
        similarity: 0.9,
        text_rank: 0,
      },
      {
        id: "c2",
        user_id: "user-1",
        source_type: "transcript",
        source: {
          transcriptId: "t1",
          recordingId: "r1",
          startMs: 100,
          endMs: 200,
        },
        chunk_index: 0,
        content: "transcript chunk",
        similarity: 0.8,
        text_rank: 0,
      },
      {
        id: "bad-doc",
        user_id: "user-1",
        source_type: "document",
        source: { documentId: 123 },
        chunk_index: 0,
        content: "bad",
        similarity: 0.7,
        text_rank: 0,
      },
      {
        id: "bad-transcript",
        user_id: "user-1",
        source_type: "transcript",
        source: { transcriptId: "t2" },
        chunk_index: 0,
        content: "bad",
        similarity: 0.7,
        text_rank: 0,
      },
    ]);

    expect(parsed.documents).toEqual([
      { documentId: "d1", content: "doc chunk", similarity: 0.9 },
    ]);
    expect(parsed.transcripts).toEqual([
      {
        transcriptId: "t1",
        recordingId: "r1",
        startMs: 100,
        endMs: 200,
        content: "transcript chunk",
        similarity: 0.8,
      },
    ]);
  });
});
