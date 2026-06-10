import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { appendLiveSegments } from "@/server/services/live-sessions";

type RouteContext = { params: Promise<{ recordingId: string }> };

const appendSchema = z.object({
  segments: z
    .array(
      z.object({
        startMs: z.number().int().min(0),
        endMs: z.number().int().min(0),
        text: z.string().max(10_000),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(request: Request, context: RouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { recordingId } = await context.params;

  const parsed = await parseJsonBody(request, appendSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await appendLiveSegments(ctx, {
      recordingId,
      segments: parsed.data.segments,
    });
    return Response.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
