import { describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/services/errors";
import type { StorageProvider } from "@/server/services/storage-provider";
import {
  createUploadedFile,
  isAllowedUploadMimeType,
} from "@/server/services/uploads";
import { createContext, type Row } from "./fake-supabase";

function fakeStorage(): StorageProvider & {
  upload: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
  return {
    upload: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
}

describe("isAllowedUploadMimeType", () => {
  it.each([
    ["application/pdf", true],
    ["APPLICATION/PDF", true],
    ["audio/mpeg", true],
    ["audio/wav", true],
    ["image/png", false],
    ["application/zip", false],
    ["text/plain", false],
    ["application/msword", false],
    ["", false],
  ])("%s -> %s", (mime, allowed) => {
    expect(isAllowedUploadMimeType(mime)).toBe(allowed);
  });
});

describe("createUploadedFile type gate", () => {
  it("rejects a disallowed type without writing to storage", async () => {
    const parent: Row = {
      id: "parent-1",
      user_id: "user-1",
      workspace_id: "ws-1",
      kind: "page",
    };
    const ctx = createContext({ library_nodes: [parent] });
    const storage = fakeStorage();

    await expect(
      createUploadedFile(ctx, {
        bucket: "uploads",
        name: "evil.png",
        mimeType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
        parentId: "parent-1",
        storage,
        enqueueTranscription: vi.fn(),
      }),
    ).rejects.toMatchObject({
      constructor: ServiceError,
      code: "invalid_input",
    });

    expect(storage.upload).not.toHaveBeenCalled();
  });
});
