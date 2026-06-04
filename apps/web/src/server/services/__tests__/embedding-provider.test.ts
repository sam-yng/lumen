import { describe, expect, it } from "vitest";
import {
  assertEmbedding,
  DeterministicEmbeddingProvider,
  EMBEDDING_DIMENSIONS,
} from "@/server/services/embedding-provider";

function l2Norm(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

describe("DeterministicEmbeddingProvider", () => {
  it("returns a 384-dimensional vector for each input text", async () => {
    const provider = new DeterministicEmbeddingProvider();

    const embeddings = await provider.embed([
      "mitochondria powers the cell",
      "photosynthesis converts light",
    ]);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(embeddings[1]).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("rejects empty text before embedding", async () => {
    const provider = new DeterministicEmbeddingProvider();

    await expect(provider.embed(["valid text", " \n\t "])).rejects.toThrow(
      "Cannot embed empty text.",
    );
  });

  it("is deterministic and L2-normalized for repeated non-empty input", async () => {
    const provider = new DeterministicEmbeddingProvider();

    const [first] = await provider.embed(["Cells use ATP for energy."]);
    const [second] = await provider.embed(["Cells use ATP for energy."]);

    expect(first).toEqual(second);
    expect(l2Norm(first ?? [])).toBeCloseTo(1, 6);
    expect(first?.some((value) => value !== 0)).toBe(true);
  });
});

describe("assertEmbedding", () => {
  it("returns valid embeddings unchanged", () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
    vector[0] = 1;

    expect(assertEmbedding(vector)).toBe(vector);
  });

  it("throws for wrong dimensions or non-finite values", () => {
    expect(() => assertEmbedding([1, 2, 3])).toThrow(
      "Embedding must have 384 dimensions.",
    );

    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
    vector[10] = Number.NaN;

    expect(() => assertEmbedding(vector)).toThrow(
      "Embedding values must be finite numbers.",
    );
  });

  it("throws for sparse arrays with holes", () => {
    expect(() => assertEmbedding(Array(EMBEDDING_DIMENSIONS))).toThrow(
      "Embedding values must be finite numbers.",
    );
  });
});
