export const EMBEDDING_DIMENSIONS = 384;

export type EmbeddingProvider = {
  embed(texts: string[]): Promise<number[][]>;
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [text];
}

function hashToken(token: string, seed: number) {
  let hash = seed;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    const normalizedTexts = texts.map((text) => normalizeText(text));

    if (normalizedTexts.some((text) => text.length === 0)) {
      throw new Error("Cannot embed empty text.");
    }

    return normalizedTexts.map((text) => {
      const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);

      for (const token of tokenize(text)) {
        const dimensionHash = hashToken(token, 2_166_136_261);
        const signHash = hashToken(token, 709_607);
        const dimension = dimensionHash % EMBEDDING_DIMENSIONS;
        const sign = signHash % 2 === 0 ? 1 : -1;

        vector[dimension] += sign;
      }

      return assertEmbedding(normalizeVector(vector));
    });
  }
}

export function assertEmbedding(vector: number[]): number[] {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Embedding must have 384 dimensions.");
  }

  for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
    if (!Number.isFinite(vector[index])) {
      throw new Error("Embedding values must be finite numbers.");
    }
  }

  return vector;
}
