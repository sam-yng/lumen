import {
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getServerEnv } from "@/server/config/env";
import { createServerSupabase } from "@/server/db/client";
import type { ServiceSupabaseClient } from "@/server/services/context";
import { finalizeLiveSession } from "@/server/services/live-sessions";
import { SupabaseStorageProvider } from "@/server/services/storage-provider";

type RouteContext = { params: Promise<{ recordingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorizedResponse();

  const { recordingId } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Invalid multipart form data." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return Response.json({ error: "Missing session audio." }, { status: 400 });
  }

  const languageValue = formData.get("language");
  const language =
    typeof languageValue === "string" && languageValue.trim() !== ""
      ? languageValue.trim()
      : null;

  try {
    const result = await finalizeLiveSession(
      {
        userId: user.id,
        supabase: supabase as unknown as ServiceSupabaseClient,
      },
      {
        recordingId,
        audio: {
          bytes: new Uint8Array(await audio.arrayBuffer()),
          contentType: audio.type || "audio/webm",
        },
        language,
        bucket: getServerEnv().TRANSCRIPTION_STORAGE_BUCKET,
        storage: new SupabaseStorageProvider(supabase.storage),
      },
    );

    return Response.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
