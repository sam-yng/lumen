import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
  uuidSchema,
} from "@/app/api/library/http";
import {
  createPageNode,
  createWorkspaceNode,
} from "@/server/services/library-nodes";

const createNodeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace"), title: z.string().min(1) }),
  z.object({
    kind: z.literal("page"),
    title: z.string().min(1),
    parentId: uuidSchema,
    role: z.enum(["note", "folder"]).optional(),
  }),
]);

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, createNodeSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const node =
      parsed.data.kind === "workspace"
        ? await createWorkspaceNode(ctx, { title: parsed.data.title })
        : await createPageNode(ctx, {
            title: parsed.data.title,
            parentId: parsed.data.parentId,
            role: parsed.data.role,
          });
    return Response.json(node, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
