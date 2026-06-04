import { describe, expect, it } from "vitest";

// Smoke test: proves the Vitest harness runs under Bun and `bun run check`
// has at least one passing test (not zero). Real tests arrive from M2.
describe("harness", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
