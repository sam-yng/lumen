import { describe, expect, it } from "vitest";
import type { ServiceError } from "@/server/services/errors";
import { SupabaseStorageProvider } from "@/server/services/storage-provider";

function storageWithDownload(error: { message: string } | null, data = null) {
  return {
    from() {
      return {
        async upload() {
          return { error: null };
        },
        async remove() {
          return { error: null };
        },
        async download() {
          return { data, error };
        },
      };
    },
  };
}

describe("SupabaseStorageProvider", () => {
  it("maps missing storage objects to not_found", async () => {
    const provider = new SupabaseStorageProvider(
      storageWithDownload({ message: "Object not found" }),
    );

    await expect(
      provider.download({ bucket: "library-files", key: "missing.m4a" }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "File not found.",
    } satisfies Partial<ServiceError>);
  });
});
