import { z } from "zod";
import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { searchLibrary } from "@/server/services/search";

const querySchema = z.string().trim().min(1).max(200);

export async function GET(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ results: [] });

  try {
    return Response.json({ results: await searchLibrary(ctx, parsed.data) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
