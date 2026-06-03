import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { createFileMetadata } from "@/server/services/files";

const createFileSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  kind: z.enum(["audio", "other"]),
  folderId: nullableUuidSchema.optional().default(null),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createFileSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const file = await createFileMetadata(ctx, parsed.data);
    return Response.json(file, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
