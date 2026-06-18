import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { bulkDeleteLibraryNodes } from "@/server/services/library-nodes";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, bulkDeleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    return Response.json(await bulkDeleteLibraryNodes(ctx, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
