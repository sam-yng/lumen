import { describe, expect, it } from "vitest";
import {
  assignCitationLabels,
  type GroundedCandidate,
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
