import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

describe("global interaction cursors", () => {
  it("uses the pointer cursor for enabled click targets", () => {
    expect(globalCss).toContain("button:not(:disabled)");
    expect(globalCss).toContain('a[href]:not([aria-disabled="true"])');
    expect(globalCss).toContain("select:not(:disabled)");
    expect(globalCss).toContain(
      '[role="button"]:not([aria-disabled="true"]):not([data-disabled])',
    );
    expect(globalCss).toContain(
      '[role="menuitem"]:not([aria-disabled="true"]):not([data-disabled])',
    );
    expect(globalCss).toContain("cursor: pointer;");
  });
});
