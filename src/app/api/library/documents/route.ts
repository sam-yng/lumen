import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { createDocument } from "@/server/services/documents";

const createDocumentSchema = z.object({
  title: z.string().min(1),
  folderId: nullableUuidSchema.optional().default(null),
});

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createDocumentSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const document = await createDocument(ctx, parsed.data);
    return Response.json(document, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
