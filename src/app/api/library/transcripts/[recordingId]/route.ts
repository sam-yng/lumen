import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getTranscriptDetail } from "@/server/services/transcripts";

type TranscriptRouteContext = { params: Promise<{ recordingId: string }> };

export async function GET(_request: Request, context: TranscriptRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { recordingId } = await context.params;

  try {
    return Response.json(await getTranscriptDetail(ctx, { recordingId }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
