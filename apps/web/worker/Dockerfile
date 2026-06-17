# Worker image for Railway. Build context = REPO ROOT (monorepo):
#   docker build -f apps/web/worker/Dockerfile -t lumen-worker .
#
# Runs the single three-job worker process (batch transcription,
# live-session speaker labels, stale-live sweep) via `bun run worker:transcribe`
# from apps/web. The worker connects with the service role and BYPASSES RLS —
# every query is user_id-scoped in code. See docs/SECURITY.md.
FROM oven/bun:1-debian

# Native deps:
# - nodejs-whisper compiles whisper.cpp on install (make/cmake/g++/python3)
# - ffmpeg is a runtime dep of whisper transcription AND of
#   worker/audio-convert.ts (webm→WAV for live-session speaker labeling)
# - sherpa-onnx-node (diarization) pulls a prebuilt native binary at install;
#   bzip2 extracts the segmentation model's .tar.bz2 archive at build;
#   wget is required by whisper.cpp's download-ggml-model.sh
# - git is required by whisper.cpp's CMake configure step
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ffmpeg make cmake g++ python3 ca-certificates bzip2 wget git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests first, so `bun install` is cached when only source changes.
# All workspace members the lockfile references must be present for a frozen
# install to resolve.
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/marketing/package.json apps/marketing/package.json
COPY packages/ui/package.json packages/ui/package.json

# postinstall compiles whisper.cpp; sherpa-onnx-node fetches its native binary.
RUN bun install --frozen-lockfile

# App source the worker imports (worker + server modules + scripts).
COPY packages/ui packages/ui
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/web/src apps/web/src
COPY apps/web/worker apps/web/worker
COPY apps/web/scripts apps/web/scripts

WORKDIR /app/apps/web

# Bake the whisper model so the first job has zero download latency.
ENV WHISPER_MODEL=base.en
RUN bun run worker:download-model

# nodejs-whisper skips its build path when the model already exists, so verify
# the native executable independently. Railway should fail the image build here
# instead of publishing a worker that can only fail after it picks up a job.
RUN cmake -S node_modules/nodejs-whisper/cpp/whisper.cpp -B node_modules/nodejs-whisper/cpp/whisper.cpp/build \
  && cmake --build node_modules/nodejs-whisper/cpp/whisper.cpp/build --config Release \
  && test -x node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-cli

# Bake the diarization ONNX models so live-session speaker labeling works
# offline. Point the worker at these paths via DIARIZATION_*_MODEL_PATH:
#   /app/apps/web/.models/diarization/{segmentation,embedding}.onnx
RUN bun run worker:diarization-models

# Secrets (SUPABASE_SECRET_KEY, PG_BOSS_DATABASE_URL, DIARIZATION_*) are
# injected by Railway at runtime.
CMD ["bun", "run", "worker:transcribe"]
