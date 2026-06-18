import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
}));

const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: mocks.maybeSingle,
};
const supabase = {
  auth: { getUser: mocks.getUser },
  from: vi.fn(() => query),
  storage: {},
};

vi.mock("@/server/db/client", () => ({
  createServerSupabase: vi.fn(async () => supabase),
}));
vi.mock("@/server/config/env", () => ({
  getServerEnv: () => ({ TRANSCRIPTION_STORAGE_BUCKET: "library-files" }),
}));
vi.mock("@/server/services/storage-provider", () => ({
  SupabaseStorageProvider: class {
    download = mocks.download;
  },
}));

import { GET } from "@/app/api/library/nodes/[id]/content/route";

describe("library node content route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "audio-1",
        user_id: "user-1",
        kind: "audio",
        title: 'Lecture "one".webm',
        mime_type: "audio/webm",
        storage_key: "user-1/audio-1",
      },
      error: null,
    });
    mocks.download.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "audio/webm",
    });
  });

  it("downloads an owned file or audio node", async () => {
    const response = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: "audio-1" }),
    });

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("library_nodes");
    expect(query.eq).toHaveBeenCalledWith("id", "audio-1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.download).toHaveBeenCalledWith({
      bucket: "library-files",
      key: "user-1/audio-1",
    });
    expect(response.headers.get("Content-Type")).toBe("audio/webm");
    expect(response.headers.get("Content-Disposition")).toContain(
      "Lecture one.webm",
    );
  });

  it("rejects an unauthenticated request", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: "audio-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
