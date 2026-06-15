# Web image for Railway. Build context = REPO ROOT (monorepo):
#   docker build -f apps/web/Dockerfile -t lumen-web .
#
# Runs the Next.js production server (`next start`) for @lumen/web. Built in CI
# (or any host with enough RAM) because `next build` OOMs on small Railway
# build containers. The companion worker image is apps/web/worker/Dockerfile.
FROM oven/bun:1-debian

# Native deps exist only so the monorepo `bun install` postinstall succeeds
# (nodejs-whisper compiles whisper.cpp; sherpa-onnx-node fetches a native
# binary). The web runtime never loads these — they are worker-only — but a
# frozen install resolves the whole workspace.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       make cmake g++ python3 ca-certificates bzip2 wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests first so `bun install` is cached when only source changes.
# All workspace members the lockfile references must be present for a frozen
# install to resolve.
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/marketing/package.json apps/marketing/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN bun install --frozen-lockfile

# Source needed to build the web app.
COPY packages/ui packages/ui
COPY apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/components.json apps/web/
COPY apps/web/sentry.edge.config.ts apps/web/sentry.server.config.ts apps/web/
COPY apps/web/public apps/web/public
COPY apps/web/src apps/web/src

# Build web only. Sentry source-map upload is skipped without SENTRY_AUTH_TOKEN
# (see next.config.ts) — keeps the build lean and avoids the upload OOM.
ENV NODE_ENV=production
RUN bunx turbo run build --filter=@lumen/web

WORKDIR /app/apps/web

# Railway injects PORT + all runtime secrets (Supabase keys, ASSISTANT_ENABLED…).
# `next start` binds 0.0.0.0 and honors $PORT.
EXPOSE 3000
CMD ["bun", "run", "start"]
