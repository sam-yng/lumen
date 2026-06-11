import {
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getServerEnv } from "@/server/config/env";
import { createServerSupabase } from "@/server/db/client";
import { enqueueSpeakerLabelJob } from "@/server/queue/transcription-jobs";
import { getTranscriptionBoss } from "@/server/queue/runtime";
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
    const env = getServerEnv();
    const { file, ...result } = await finalizeLiveSession(
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
        bucket: env.TRANSCRIPTION_STORAGE_BUCKET,
        storage: new SupabaseStorageProvider(supabase.storage),
      },
    );

    // Post-finalize speaker labeling (v4 m4): never blocks or fails finalize.
    await enqueueSpeakerLabelJob({
      enabled: env.DIARIZATION_ENABLED,
      getBoss: getTranscriptionBoss,
      payload: {
        userId: user.id,
        recordingId,
        fileId: file.id,
        storageKey: file.storage_key,
      },
    });

    return Response.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
