import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { deleteDocument, updateDocument } from "@/server/services/documents";

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  folderId: nullableUuidSchema.optional(),
});

type IdRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, updateDocumentSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;

  try {
    return Response.json(await updateDocument(ctx, { id, ...parsed.data }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    return Response.json(await deleteDocument(ctx, { id }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
