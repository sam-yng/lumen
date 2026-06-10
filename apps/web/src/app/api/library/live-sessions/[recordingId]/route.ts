import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { cancelLiveSession } from "@/server/services/live-sessions";

type RouteContext = { params: Promise<{ recordingId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { recordingId } = await context.params;

  try {
    const result = await cancelLiveSession(ctx, { recordingId });
    return Response.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
