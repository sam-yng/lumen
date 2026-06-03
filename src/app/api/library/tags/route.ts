import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { createTag } from "@/server/services/tags";

const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).nullable().optional().default(null),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createTagSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const tag = await createTag(ctx, parsed.data);
    return Response.json(tag, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
