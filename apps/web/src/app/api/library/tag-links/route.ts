import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
  uuidSchema,
} from "@/app/api/library/http";
import { linkTagToNode } from "@/server/services/tags";

const createTagLinkSchema = z.object({
  tagId: uuidSchema,
  nodeId: uuidSchema,
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createTagLinkSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const link = await linkTagToNode(ctx, parsed.data);
    return Response.json(link, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
