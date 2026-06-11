/**
 * Retrieval-eval metrics (v4 m3 harness). Pure helpers over ranked id lists;
 * see docs/exec-plans/active/v4/retrieval-quality-reranking.md.
 */

export function recallAtK(
  rankedIds: readonly string[],
  relevantIds: readonly string[],
  k: number,
): number {
  if (relevantIds.length === 0) {
    throw new Error("recallAtK requires at least one relevant id.");
  }
  const top = new Set(rankedIds.slice(0, k));
  const found = relevantIds.filter((id) => top.has(id)).length;
  return found / relevantIds.length;
}

export function reciprocalRank(
  rankedIds: readonly string[],
  relevantIds: readonly string[],
): number {
  const relevant = new Set(relevantIds);
  const index = rankedIds.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("mean requires a non-empty input.");
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
