import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { deleteFolder, updateFolder } from "@/server/services/folders";

const updateFolderSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: nullableUuidSchema.optional(),
});

type IdRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, updateFolderSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;

  try {
    return Response.json(await updateFolder(ctx, { id, ...parsed.data }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    return Response.json(await deleteFolder(ctx, { id }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
