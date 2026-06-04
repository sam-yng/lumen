import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { deleteTag, updateTag } from "@/server/services/tags";

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).nullable().optional(),
});

type IdRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, updateTagSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;

  try {
    return Response.json(await updateTag(ctx, { id, ...parsed.data }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    return Response.json(await deleteTag(ctx, { id }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
