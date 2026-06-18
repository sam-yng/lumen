import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryContent } from "@/components/library/library-content";
import type { LibraryNode } from "@/server/services/library-nodes";

const apiMocks = vi.hoisted(() => ({
  bulkDeleteNodes: vi.fn(),
  bulkMoveNodes: vi.fn(),
}));

vi.mock("@/components/library/library-api", () => ({
  libraryQueryKey: ["library"],
  bulkDeleteNodes: apiMocks.bulkDeleteNodes,
  bulkMoveNodes: apiMocks.bulkMoveNodes,
}));

function node(id: string, title: string): LibraryNode {
  return {
    id,
    user_id: "user-1",
    workspace_id: "workspace-1",
    parent_id: "workspace-1",
    kind: "page",
    title,
    slug: `${id}-slug`,
    content_json: null,
    content_text: null,
    content_tsv: null,
    mime_type: null,
    size_bytes: null,
    storage_key: null,
    is_pinned: false,
    created_at: "2026-06-18T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
  };
}

const nodes = [
  {
    ...node("workspace-1", "Workspace"),
    kind: "workspace" as const,
    workspace_id: "workspace-1",
    parent_id: null,
  },
  node("alpha", "Alpha"),
  node("beta", "Beta"),
  node("gamma", "Gamma"),
];

function renderContent(onOpen = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    onOpen,
    ...render(
      <QueryClientProvider client={queryClient}>
        <LibraryContent
          nodes={nodes}
          parentId="workspace-1"
          atRoot={false}
          onOpen={onOpen}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("LibraryContent desktop selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports single, Ctrl/Cmd toggle, Shift range, double-click, and clear", () => {
    const { onOpen } = renderContent();
    const alpha = screen.getByRole("button", { name: /Alpha/ });
    const beta = screen.getByRole("button", { name: /Beta/ });
    const gamma = screen.getByRole("button", { name: /Gamma/ });

    fireEvent.click(alpha);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(beta, { ctrlKey: true });
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(gamma, { shiftKey: true });
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Gamma/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(screen.getByRole("button", { name: "Move" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    fireEvent.doubleClick(gamma);
    expect(onOpen).toHaveBeenCalledWith("gamma");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText(/selected$/)).toBeNull();
  });

  it("shows a blocking busy overlay while bulk delete is pending", async () => {
    let resolveDelete: (nodes: LibraryNode[]) => void = () => undefined;
    apiMocks.bulkDeleteNodes.mockReturnValue(
      new Promise<LibraryNode[]>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    renderContent();

    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete selected" }),
    );

    expect(
      await screen.findByRole("status", {
        name: "Deleting selected nodes",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeDisabled();

    resolveDelete([]);
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: "Deleting selected nodes" }),
      ).toBeNull(),
    );
    expect(apiMocks.bulkDeleteNodes.mock.calls[0]?.[0]).toEqual({
      ids: ["alpha"],
    });
  });
});
