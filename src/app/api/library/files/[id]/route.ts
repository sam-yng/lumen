import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import {
  deleteFileMetadata,
  updateFileMetadata,
} from "@/server/services/files";

const updateFileSchema = z.object({
  name: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  kind: z.enum(["audio", "other"]).optional(),
  folderId: nullableUuidSchema.optional(),
});

type IdRouteContext = { params: Promise<{ id: string }> };

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
