import { z } from "zod";
import {
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getServerEnv } from "@/server/config/env";
import { createServerSupabase } from "@/server/db/client";
import { getTranscriptionBoss } from "@/server/queue/runtime";
import { enqueueTranscriptionJob } from "@/server/queue/transcription-jobs";
import type { ServiceSupabaseClient } from "@/server/services/context";
import { SupabaseStorageProvider } from "@/server/services/storage-provider";
import { createUploadedFile } from "@/server/services/uploads";

const parentIdSchema = z.string().uuid();

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseParentId(formData: FormData) {
  return parentIdSchema.parse(formString(formData, "parentId").trim());
}

function parseFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File)) return null;
  return value;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorizedResponse();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Invalid multipart form data." },
      { status: 400 },
    );
  }

  const file = parseFile(formData);
  if (!file) {
    return Response.json({ error: "Missing upload file." }, { status: 400 });
  }

  let parentId: string;
  try {
    parentId = parseParentId(formData);
  } catch (error) {
    return Response.json(
      {
        error: "Invalid parent node id.",
        issues: error instanceof z.ZodError ? z.treeifyError(error) : undefined,
      },
      { status: 400 },
    );
  }

  try {
    const result = await createUploadedFile(
      {
        userId: user.id,
        supabase: supabase as unknown as ServiceSupabaseClient,
      },
      {
        bucket: getServerEnv().TRANSCRIPTION_STORAGE_BUCKET,
        name: formString(formData, "name").trim() || file.name,
        mimeType: file.type || "application/octet-stream",
        bytes: new Uint8Array(await file.arrayBuffer()),
        parentId,
        storage: new SupabaseStorageProvider(supabase.storage),
        enqueueTranscription: async (payload) => {
          await enqueueTranscriptionJob(await getTranscriptionBoss(), payload);
        },
      },
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
