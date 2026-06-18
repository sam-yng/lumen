import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibrarySidebar } from "@/components/library/library-sidebar";

describe("LibrarySidebar", () => {
  it("links to the recents view", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <LibrarySidebar
          view={"recents" as never}
          folders={[]}
          selectedFolderId={null}
          tags={[]}
          selectedTagId={null}
          userEmail="demo@lumen.test"
          signOutAction={vi.fn()}
          onSelectFolder={vi.fn()}
          onSelectTag={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onFocusSearch={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Recents" })).toHaveAttribute(
      "href",
      "/library/recents",
    );
  });
});
