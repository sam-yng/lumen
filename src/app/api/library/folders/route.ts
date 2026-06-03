import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { createFolder } from "@/server/services/folders";

const createFolderSchema = z.object({
  name: z.string().min(1),
  parentId: nullableUuidSchema.optional().default(null),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createFolderSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const folder = await createFolder(ctx, parsed.data);
    return Response.json(folder, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
