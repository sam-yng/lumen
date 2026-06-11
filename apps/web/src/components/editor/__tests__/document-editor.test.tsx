import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentEditor } from "@/components/editor/document-editor";
import type { Tables } from "@/server/db/database.types";

vi.mock("@/components/library/library-api", () => ({
  libraryQueryKey: ["library"],
  updateDocument: vi.fn(),
}));

function documentRow(overrides: Partial<Tables<"documents">> = {}) {
  return {
    id: "doc-1",
    user_id: "user-1",
    folder_id: null,
    title: "Biology notes",
    content_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Third paragraph" }],
        },
      ],
    },
    content_text: "First paragraph Second paragraph Third paragraph",
    content_tsv: null as unknown,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } satisfies Tables<"documents">;
}

function renderEditor(citationBlockIndex: number | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <DocumentEditor
        document={documentRow()}
        citationBlockIndex={citationBlockIndex}
      />
    </QueryClientProvider>,
  );
}

describe("DocumentEditor citation block links", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Document.prototype.elementFromPoint = vi.fn(() => document.body);
  });

  afterEach(() => vi.restoreAllMocks());

  it("marks, highlights, and scrolls to the cited block", async () => {
    renderEditor(1);

    const targetText = await screen.findByText("Second paragraph");
    const targetBlock = targetText.closest("[data-citation-block='1']");

    expect(targetBlock).not.toBeNull();
    await waitFor(() =>
      expect(targetBlock?.className).toContain("l-citation-block-active"),
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
