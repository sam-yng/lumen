import { ServiceError } from "@/server/services/errors";

export type StorageObjectInput = {
  bucket: string;
  key: string;
};

export type StorageUploadInput = StorageObjectInput & {
  bytes: Uint8Array;
  contentType: string;
};

export type StorageDownloadResult = {
  bytes: Uint8Array;
  contentType: string | null;
};

export type StorageProvider = {
  upload(input: StorageUploadInput): Promise<void>;
  remove(input: StorageObjectInput): Promise<void>;
  download?(input: StorageObjectInput): Promise<StorageDownloadResult>;
};

type StorageError = {
  message: string;
};

type SupabaseStorageBucket = {
  upload(
    path: string,
    body: Uint8Array,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: StorageError | null }>;
  remove(paths: string[]): Promise<{ error: StorageError | null }>;
  download(
    path: string,
  ): Promise<{ data: Blob | null; error: StorageError | null }>;
};

type SupabaseStorageClient = {
  from(bucket: string): SupabaseStorageBucket;
};

export class SupabaseStorageProvider implements StorageProvider {
  constructor(private readonly storage: SupabaseStorageClient) {}

  async upload(input: StorageUploadInput) {
    const { error } = await this.storage
      .from(input.bucket)
      .upload(input.key, input.bytes, {
        contentType: input.contentType,
        upsert: false,
      });

    if (error) {
      throw new ServiceError(
        "database",
        `Could not upload file: ${error.message}`,
      );
    }
  }

  async remove(input: StorageObjectInput) {
    const { error } = await this.storage.from(input.bucket).remove([input.key]);
    if (error) {
      throw new ServiceError(
        "database",
        `Could not remove file: ${error.message}`,
      );
    }
  }

  async download(input: StorageObjectInput) {
    const { data, error } = await this.storage
      .from(input.bucket)
      .download(input.key);
    if (error) {
      if (error.message.toLowerCase().includes("not found")) {
        throw new ServiceError("not_found", "File not found.");
      }
      throw new ServiceError(
        "database",
        `Could not download file: ${error.message}`,
      );
    }
    if (!data) throw new ServiceError("not_found", "File not found.");

    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || null,
    };
  }
}

function slugFileName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "file";
}

export function storageKeyForUpload(
  userId: string,
  fileName: string,
  uniqueId: string,
) {
  return `${userId}/${uniqueId}-${slugFileName(fileName)}`;
}
