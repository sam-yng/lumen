import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCorpus,
  type FixtureDocument,
  type FixtureQuery,
} from "@/server/services/__tests__/retrieval-eval/corpus";
import { runGroundedQuery } from "@/server/services/__tests__/retrieval-eval/run-eval";
import { DeterministicEmbeddingProvider } from "@/server/services/embedding-provider";

const provider = new DeterministicEmbeddingProvider();

const docs: FixtureDocument[] = [
  {
    id: "doc-mito",
    title: "Cell biology",
    text: "The mitochondria is the powerhouse of the cell and produces ATP energy.",
  },
  {
    id: "doc-photo",
    title: "Plant biology",
    text: "Photosynthesis converts sunlight into chemical energy inside chloroplasts.",
  },
];

describe("buildCorpus", () => {
  it("produces owned table rows and embedded chunk rows", async () => {
    const corpus = await buildCorpus({
      documents: docs,
      transcripts: [],
      queries: [],
    });
    expect(corpus.tables.documents).toHaveLength(2);
    expect(corpus.chunkRows.length).toBeGreaterThanOrEqual(2);
    for (const chunk of corpus.chunkRows) {
      expect(chunk.userId).toBe("user-1");
      expect(chunk.embedding).toHaveLength(384);
    }
  });
});

describe("runGroundedQuery", () => {
  const query: FixtureQuery = {
    id: "q-mito",
    kind: "keyword",
    text: "mitochondria",
    relevantSourceIds: ["doc:doc-mito"],
  };
  let corpus: Awaited<ReturnType<typeof buildCorpus>>;
  beforeAll(async () => {
    corpus = await buildCorpus({
      documents: docs,
      transcripts: [],
      queries: [query],
    });
  });

  it("returns the relevant source within the hybrid top-k", async () => {
    const result = await runGroundedQuery({
      corpus,
      query,
      provider,
      mode: "hybrid",
    });
    expect(result.rankedSourceIds).toContain("doc:doc-mito");
    expect(result.poolSourceIds).toContain("doc:doc-mito");
  });

  it("runs a lexical-only mode without an embedding provider", async () => {
    const result = await runGroundedQuery({
      corpus,
      query,
      provider,
      mode: "lexical",
    });
    expect(result.rankedSourceIds).toContain("doc:doc-mito");
  });
});
