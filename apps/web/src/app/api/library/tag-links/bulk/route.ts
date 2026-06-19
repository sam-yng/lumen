import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
  uuidSchema,
} from "@/app/api/library/http";
import { setTagOnNodes } from "@/server/services/tags";

const bulkTagLinksSchema = z.object({
  tagId: uuidSchema,
  nodeIds: z.array(uuidSchema).min(1),
  linked: z.boolean(),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, bulkTagLinksSchema);
  if (!parsed.ok) return parsed.response;

  try {
    return Response.json(await setTagOnNodes(ctx, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
