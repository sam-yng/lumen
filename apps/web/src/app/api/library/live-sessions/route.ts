import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
  uuidSchema,
} from "@/app/api/library/http";
import { startLiveSession } from "@/server/services/live-sessions";

const startSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: nullableUuidSchema,
  workspaceId: uuidSchema,
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, startSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const session = await startLiveSession(ctx, parsed.data);
    return Response.json(session, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
