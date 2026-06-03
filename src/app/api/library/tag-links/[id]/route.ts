import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { unlinkTag } from "@/server/services/tags";

type IdRouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    return Response.json(await unlinkTag(ctx, { linkId: id }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
