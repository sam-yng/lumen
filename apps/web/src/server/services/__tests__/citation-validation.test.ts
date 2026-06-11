import { describe, expect, it } from "vitest";
import { validateCitations } from "@/server/services/citation-validation";
import type { GroundedSource } from "@/server/services/grounded-retrieval";

function source(citationId: string): GroundedSource {
  return {
    citationId,
    kind: "document",
    title: `Note ${citationId}`,
    snippet: "snippet",
    score: 0.5,
    source: { documentId: `doc-${citationId}` },
  };
}

describe("validateCitations", () => {
  it("keeps only sources that are actually cited", () => {
    const result = validateCitations("Cells respire [S1].", [
      source("S1"),
      source("S2"),
    ]);
    expect(result.sources.map((s) => s.citationId)).toEqual(["S1"]);
    expect(result.invalidCitations).toEqual([]);
    expect(result.summary).toEqual({ validMentions: 1, invalidMentions: 0 });
  });

  it("flags citations that match no retrieved source", () => {
    const result = validateCitations("Fact [S1]. Invented [S3].", [
      source("S1"),
    ]);
    expect(result.sources.map((s) => s.citationId)).toEqual(["S1"]);
    expect(result.invalidCitations).toEqual(["S3"]);
    expect(result.summary).toEqual({ validMentions: 1, invalidMentions: 1 });
  });

  it("counts duplicate mentions but lists each source and label once", () => {
    const result = validateCitations("A [S1]. B [S1]. C [S9]. D [S9].", [
      source("S1"),
    ]);
    expect(result.sources.map((s) => s.citationId)).toEqual(["S1"]);
    expect(result.invalidCitations).toEqual(["S9"]);
    expect(result.summary).toEqual({ validMentions: 2, invalidMentions: 2 });
  });

  it("treats pattern-shaped but unknown labels like S01 as invalid", () => {
    const result = validateCitations("Zero-padded [S01].", [source("S1")]);
    expect(result.sources).toEqual([]);
    expect(result.invalidCitations).toEqual(["S01"]);
    expect(result.summary).toEqual({ validMentions: 0, invalidMentions: 1 });
  });

  it("ignores text that does not match the citation pattern", () => {
    const result = validateCitations("Lowercase [s1], bare [S], empty [].", [
      source("S1"),
    ]);
    expect(result.sources).toEqual([]);
    expect(result.invalidCitations).toEqual([]);
    expect(result.summary).toEqual({ validMentions: 0, invalidMentions: 0 });
  });

  it("marks every citation invalid when no sources were retrieved", () => {
    const result = validateCitations("Claim [S1] and [S2].", []);
    expect(result.sources).toEqual([]);
    expect(result.invalidCitations).toEqual(["S1", "S2"]);
    expect(result.summary).toEqual({ validMentions: 0, invalidMentions: 2 });
  });

  it("returns empty results for an answer without citations", () => {
    const result = validateCitations("No citations here.", [source("S1")]);
    expect(result.sources).toEqual([]);
    expect(result.invalidCitations).toEqual([]);
    expect(result.summary).toEqual({ validMentions: 0, invalidMentions: 0 });
  });

  it("preserves the retrieved order of cited sources", () => {
    const result = validateCitations("Later first [S3], then [S1].", [
      source("S1"),
      source("S2"),
      source("S3"),
    ]);
    expect(result.sources.map((s) => s.citationId)).toEqual(["S1", "S3"]);
  });
});
