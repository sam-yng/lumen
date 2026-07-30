import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/extend-ui/pdf-viewer.tsx"),
  "utf8",
);
const viewerStart = source.indexOf("function PDFViewerInner");
const toolbarStart = source.indexOf("{showToolbar ? (", viewerStart);
const toolbarEnd = source.indexOf(
  "<div\n        ref={viewerShellRef}",
  toolbarStart,
);
const toolbarSource = source.slice(toolbarStart, toolbarEnd);

describe("PDFViewer toolbar", () => {
  it("only exposes thumbnails, page navigation, and zoom controls", () => {
    expect(toolbarSource).toContain('aria-label="Toggle thumbnails"');
    expect(toolbarSource).toContain("<PDFViewerPageNumberControl");
    expect(toolbarSource).toContain('aria-label="Zoom out"');
    expect(toolbarSource).toContain("<Select");
    expect(toolbarSource).toContain('aria-label="Zoom in"');

    expect(toolbarSource).not.toContain("Rotate counterclockwise");
    expect(toolbarSource).not.toContain("Rotate clockwise");
    expect(toolbarSource).not.toContain("<PDFViewerSearchControl");
    expect(toolbarSource).not.toContain("toolbarActions");
    expect(toolbarSource).not.toContain("<PDFViewerFileActionsMenu");
  });
});
