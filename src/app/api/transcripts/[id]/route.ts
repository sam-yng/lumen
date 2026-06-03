import { z } from "zod";
import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getTranscriptById } from "@/server/services/transcripts";

const idSchema = z.string().uuid();
type IdRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return Response.json({ error: "Invalid transcript id." }, { status: 400 });
  }

  try {
    const detail = await getTranscriptById(ctx, parsed.data);
    if (!detail) {
      return Response.json(
        { error: "Transcript not found.", code: "not_found" },
        { status: 404 },
      );
    }
    return Response.json(detail);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
