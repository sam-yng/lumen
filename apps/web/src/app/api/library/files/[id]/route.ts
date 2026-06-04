import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getServerEnv } from "@/server/config/env";
import { createServerSupabase } from "@/server/db/client";
import type { Tables } from "@/server/db/database.types";
import type { ServiceSupabaseClient } from "@/server/services/context";
import { assertFound, assertNoDatabaseError } from "@/server/services/errors";
import {
  deleteFileMetadata,
  updateFileMetadata,
} from "@/server/services/files";
import { SupabaseStorageProvider } from "@/server/services/storage-provider";

const updateFileSchema = z.object({
  name: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  kind: z.enum(["audio", "other"]).optional(),
  folderId: nullableUuidSchema.optional(),
});

type IdRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: IdRouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    const { data: file, error } = await (
      supabase as unknown as ServiceSupabaseClient
    )
      .from<Tables<"files">>("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    assertNoDatabaseError(error, "Could not load file");
    assertFound(file, "File not found.");

    const storage = new SupabaseStorageProvider(supabase.storage);
    const downloaded = await storage.download({
      bucket: getServerEnv().TRANSCRIPTION_STORAGE_BUCKET,
      key: file.storage_key,
    });

    return new Response(downloaded.bytes, {
      headers: {
        "Content-Type": downloaded.contentType ?? file.mime_type,
        "Content-Disposition": `inline; filename="${file.name.replaceAll('"', "")}"`,
      },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, updateFileSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;

  try {
    return Response.json(await updateFileMetadata(ctx, { id, ...parsed.data }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    return Response.json(await deleteFileMetadata(ctx, { id }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
