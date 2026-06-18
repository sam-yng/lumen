import { z } from "zod";
import {
  getRouteServiceContext,
  nullableUuidSchema,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import type { Json } from "@/server/db/database.types";
import { updateLibraryNode } from "@/server/services/library-nodes";

const updateNodeSchema = z.object({
  title: z.string().min(1).optional(),
  parentId: nullableUuidSchema.optional(),
  contentJson: z.unknown().optional(),
  isPinned: z.boolean().optional(),
});

type IdRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, updateNodeSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await context.params;
  const { contentJson: _contentJson, ...data } = parsed.data;
  const input: Parameters<typeof updateLibraryNode>[1] = { id, ...data };
  if ("contentJson" in parsed.data) {
    input.contentJson = parsed.data.contentJson as Json | null;
  }

  try {
    return Response.json(await updateLibraryNode(ctx, input));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
