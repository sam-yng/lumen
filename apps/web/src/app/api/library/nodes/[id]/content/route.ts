import {
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getServerEnv } from "@/server/config/env";
import { createServerSupabase } from "@/server/db/client";
import type { Tables } from "@/server/db/database.types";
import type { ServiceSupabaseClient } from "@/server/services/context";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";
import { SupabaseStorageProvider } from "@/server/services/storage-provider";

type IdRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: IdRouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    const { data: node, error } = await (
      supabase as unknown as ServiceSupabaseClient
    )
      .from<Tables<"library_nodes">>("library_nodes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    assertNoDatabaseError(error, "Could not load file node");
    assertFound(node, "File node not found.");
    if (
      (node.kind !== "file" && node.kind !== "audio") ||
      !node.storage_key ||
      !node.mime_type
    ) {
      throw new ServiceError("not_found", "File node not found.");
    }

    const storage = new SupabaseStorageProvider(supabase.storage);
    const downloaded = await storage.download({
      bucket: getServerEnv().TRANSCRIPTION_STORAGE_BUCKET,
      key: node.storage_key,
    });

    return new Response(downloaded.bytes, {
      headers: {
        "Content-Type": downloaded.contentType ?? node.mime_type,
        "Content-Disposition": `inline; filename="${node.title.replaceAll('"', "")}"`,
      },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
