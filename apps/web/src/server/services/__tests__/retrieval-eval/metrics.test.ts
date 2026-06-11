import { describe, expect, it } from "vitest";
import {
  mean,
  recallAtK,
  reciprocalRank,
} from "@/server/services/__tests__/retrieval-eval/metrics";

describe("recallAtK", () => {
  it("returns the fraction of relevant ids found in the top k", () => {
    expect(recallAtK(["a", "b", "c", "d"], ["a", "d"], 3)).toBe(0.5);
  });

  it("returns 1 when all relevant ids are within the top k", () => {
    expect(recallAtK(["a", "b", "c"], ["b", "a"], 2)).toBe(1);
  });

  it("returns 0 when no relevant id is within the top k", () => {
    expect(recallAtK(["x", "y", "z"], ["a"], 3)).toBe(0);
  });

  it("ignores ranked ids beyond k", () => {
    expect(recallAtK(["x", "y", "a"], ["a"], 2)).toBe(0);
  });

  it("throws on an empty relevant set", () => {
    expect(() => recallAtK(["a"], [], 3)).toThrow(/relevant/i);
  });
});

describe("reciprocalRank", () => {
  it("returns 1 over the 1-based rank of the first relevant id", () => {
    expect(reciprocalRank(["x", "a", "y"], ["a", "y"])).toBe(1 / 2);
  });

  it("returns 1 when the first result is relevant", () => {
    expect(reciprocalRank(["a", "x"], ["a"])).toBe(1);
  });

  it("returns 0 when no result is relevant", () => {
    expect(reciprocalRank(["x", "y"], ["a"])).toBe(0);
  });
});

describe("mean", () => {
  it("averages values", () => {
    expect(mean([1, 0.5, 0])).toBe(0.5);
  });

  it("throws on empty input", () => {
    expect(() => mean([])).toThrow(/empty/i);
  });
});
