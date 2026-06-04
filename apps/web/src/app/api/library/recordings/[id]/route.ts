import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getTranscriptionBoss } from "@/server/queue/runtime";
import { enqueueTranscriptionJob } from "@/server/queue/transcription-jobs";
import { retryRecordingTranscription } from "@/server/services/recordings";

type IdRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    const recording = await retryRecordingTranscription(ctx, {
      id,
      enqueueTranscription: async (payload) => {
        await enqueueTranscriptionJob(await getTranscriptionBoss(), payload);
      },
    });

    return Response.json(recording);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
