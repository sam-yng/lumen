import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getLibraryNodeSnapshot } from "@/server/services/library-nodes";

export async function GET() {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  try {
    return Response.json(await getLibraryNodeSnapshot(ctx));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
