import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
const nodeId = "11111111-1111-4111-8111-111111111111";

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/server/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/server/db/client", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { email: "reader@example.com" } },
      }),
    },
  }),
}));
vi.mock("@/components/library/library-workspace", () => ({
  LibraryWorkspace: ({
    workspaceSlug,
    nodeSlug,
  }: {
    workspaceSlug?: string;
    nodeSlug?: string;
  }) => (
    <div>
      <span data-testid="workspace-slug">{workspaceSlug ?? "root"}</span>
      <span data-testid="node-slug">{nodeSlug ?? "none"}</span>
    </div>
  ),
}));

import NodePage from "@/app/(app)/[workspaceSlug]/[nodeSlug]/page";
import WorkspacePage from "@/app/(app)/[workspaceSlug]/page";
import LegacyLivePage from "@/app/(app)/library/live/page";
import LegacyNotePage from "@/app/(app)/library/notes/[id]/page";
import LegacyLibraryPage from "@/app/(app)/library/page";
import LegacyRecentsPage from "@/app/(app)/library/recents/page";
import LegacyTagsPage from "@/app/(app)/library/tags/page";
import LegacyTranscriptPage from "@/app/(app)/library/transcripts/[recordingId]/page";
import HomePage from "@/app/(app)/page";

async function renderPage(page: Promise<ReactNode> | ReactNode) {
  render(await page);
}

describe("node navigation pages", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("renders the root library shell without route slugs", async () => {
    await renderPage(HomePage());
    expect(screen.getByTestId("workspace-slug")).toHaveTextContent("root");
    expect(screen.getByTestId("node-slug")).toHaveTextContent("none");
  });

  it("passes the workspace slug to the shared library shell", async () => {
    await renderPage(
      WorkspacePage({
        params: Promise.resolve({ workspaceSlug: "research-abcd1234" }),
      }),
    );
    expect(screen.getByTestId("workspace-slug")).toHaveTextContent(
      "research-abcd1234",
    );
    expect(screen.getByTestId("node-slug")).toHaveTextContent("none");
  });

  it("passes workspace and node slugs to the shared library shell", async () => {
    await renderPage(
      NodePage({
        params: Promise.resolve({
          workspaceSlug: "research-abcd1234",
          nodeSlug: "notes-efab5678",
        }),
      }),
    );
    expect(screen.getByTestId("workspace-slug")).toHaveTextContent(
      "research-abcd1234",
    );
    expect(screen.getByTestId("node-slug")).toHaveTextContent("notes-efab5678");
  });

  it("redirects the legacy library route to the root", async () => {
    await LegacyLibraryPage();
    await LegacyLivePage({ searchParams: Promise.resolve({}) });
    await LegacyNotePage({ params: Promise.resolve({ id: nodeId }) });
    await LegacyRecentsPage();
    await LegacyTagsPage();
    await LegacyTranscriptPage({
      params: Promise.resolve({ recordingId: nodeId }),
    });
    expect(redirect).toHaveBeenCalledTimes(6);
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
