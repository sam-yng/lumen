import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { linkTagToTarget } from "@/server/services/tags";

const createTagLinkSchema = z.object({
  tagId: z.string().uuid(),
  targetType: z.enum(["document", "file", "recording"]),
  targetId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createTagLinkSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const link = await linkTagToTarget(ctx, parsed.data);
    return Response.json(link, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
