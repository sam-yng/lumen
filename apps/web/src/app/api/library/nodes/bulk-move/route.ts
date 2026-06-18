import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
  uuidSchema,
} from "@/app/api/library/http";
import { bulkMoveLibraryNodes } from "@/server/services/library-nodes";

const bulkMoveSchema = z.object({
  ids: z.array(uuidSchema).min(1),
  parentId: nullableUuidSchema,
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, bulkMoveSchema);
  if (!parsed.ok) return parsed.response;

  try {
    return Response.json(await bulkMoveLibraryNodes(ctx, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
