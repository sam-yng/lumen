import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("allows CI assertions to wait for cold Next route compilation", async () => {
  vi.stubEnv("CI", "1");

  const { default: config } = await import("./playwright.config");

  expect(config.expect?.timeout).toBe(15_000);
});

it("keeps the fast assertion budget for local smoke runs", async () => {
  vi.stubEnv("CI", "");

  const { default: config } = await import("./playwright.config");

  expect(config.expect?.timeout).toBe(5_000);
});
