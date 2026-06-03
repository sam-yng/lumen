import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getLibrarySnapshot } from "@/server/services/library";

export async function GET() {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  try {
    return Response.json(await getLibrarySnapshot(ctx));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
