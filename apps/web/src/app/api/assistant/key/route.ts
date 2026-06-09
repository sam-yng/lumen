import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import {
  deleteApiKey,
  hasApiKey,
  saveApiKey,
} from "@/server/services/ai-credentials";

const keySchema = z.object({ key: z.string().trim().min(1).max(200) });

export async function GET() {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();
  try {
    return Response.json({ hasKey: await hasApiKey(ctx) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();
  const parsed = await parseJsonBody(request, keySchema);
  if (!parsed.ok) return parsed.response;
  try {
    await saveApiKey(ctx, parsed.data.key);
    return Response.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE() {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();
  try {
    await deleteApiKey(ctx);
    return Response.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
