# Lumen demo walkthrough

Use this as a click-by-click interview prompt. It is not a speech to memorise.

## Before you start

- Aim for about 20 minutes.
- Keep the explanation focused on what the user can see.
- Use the **What to do** bullets to drive the demo.
- Use the **What to say** bullets as short talking points.
- If somebody asks for a deeper detail, open the linked package docs or code.
- It is completely fine to say, “I would need to check the docs or code rather
  than guess.”

## 60-second introduction

- Lumen is a study workspace for notes, PDFs, recordings, transcripts, and
  tags.
- I built the web app with Next.js, React, and TypeScript.
- Supabase handles sign-in, the database, and private file storage.
- Longer transcription work runs separately so the website does not have to
  sit and wait for it.
- Live transcription can run in the browser while the user is speaking.
- The main goal was to make a useful study workflow first, with each user's
  content kept separate.

Useful reading:
[Next.js App Router](https://nextjs.org/docs/app),
[React](https://react.dev/learn),
[TypeScript](https://www.typescriptlang.org/docs/), and
[Supabase](https://supabase.com/docs).

![Request and authentication flow](demo-assets/02-request-and-auth-flow.png)

## Walkthrough

### 1. Log in

![Lumen login screen](demo-assets/01-login.jpg)

#### What to do

- Open the login page.
- Sign in with `demo@lumen.test` / `demo12345`.
- Show that a successful login opens the private library.
- If useful, open a private URL in a signed-out browser and show that Lumen
  returns to the login screen.

#### What to say

- “Supabase handles sign-in for me.”
- “If someone is not signed in, Lumen sends them back to the login page.”
- “The database also has rules that keep each user's rows separate.”
- “That means the redirect is not the only thing protecting the data.”

#### Keep this explanation simple

- Do not volunteer details about cookies, tokens, or session refresh.
- Those are implementation details handled by Supabase and its Next.js helper.
- If asked, say the app follows the Supabase server-side auth guidance and show
  the official docs or the auth code.
- Next.js 16 calls its request-time route guard `proxy.ts`. Older tutorials may
  call the same convention middleware.

#### Why these tools?

- **Supabase Auth** saved me from building login and account management from
  scratch.
- **Next.js** keeps the screens and the small amount of server-side web code in
  one project.
- **TypeScript** catches many mismatched data shapes while I am developing.
- The trade-off is depending on Supabase and learning which Next.js code runs
  in the browser or on the server.

Useful reading:
[Supabase Auth](https://supabase.com/docs/guides/auth),
[Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security),
and [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy).

If asked to show code:
[`auth/actions.ts`](../apps/web/src/server/auth/actions.ts),
[`proxy.ts`](../apps/web/src/proxy.ts), and
[`SECURITY.md`](SECURITY.md).

### 2. Walk through the library

![Seeded local library](demo-assets/06-library.jpg)

#### What to do

- Open the seeded **Course notes** workspace.
- Create a workspace.
- Open it and create a folder and a note.
- Select several rows.
- Show **Move**, **Tags**, **Delete**, and **Clear**.
- Show that clicking the check on a selected row clears the selection.
- If there is time, resize to mobile and open the sidebar drawer.

![Course notes workspace actions](demo-assets/07-workspace.jpg)

#### What to say

- “The library behaves like a small file system.”
- “A workspace can contain folders, notes, PDFs, and audio.”
- “Under the surface, they use the same basic parent-and-child structure, so I
  did not need a different navigation system for every file type.”
- “The screen keeps a recent copy of the library data so common changes feel
  immediate.”
- “Tag creation and assignment update that copy directly instead of reloading
  the entire library.”

#### Why TanStack Query and one library tree?

- **One tree** gives all library items the same move, tag, and delete rules.
- **TanStack Query** handles loading, caching, and refreshing data that came
  from the server.
- This saved me from building all of that browser state management myself.
- The trade-off is keeping the browser's copy in sync after changes.

Useful reading:
[TanStack Query overview](https://tanstack.com/query/latest/docs/framework/react/overview)
and
[query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

If asked to show code:
[`library-workspace.tsx`](../apps/web/src/components/library/library-workspace.tsx),
[`library route`](../apps/web/src/app/api/library/route.ts), and
[`library-nodes.ts`](../apps/web/src/server/services/library-nodes.ts).

### 3. Edit a note

![TipTap note editor](demo-assets/08-note-editor.jpg)

#### What to do

- Open a note.
- Type a short sentence.
- Add a task list, link, or table if there is time.
- Point out the saving message.
- Wait for **Saved** before leaving.

#### What to say

- “TipTap gave me a rich-text editor that I could style for Lumen.”
- “The note keeps its formatting, but I also keep a plain-text version for
  search.”
- “Saving is automatic, and the status tells the user when it is safe to move
  on.”

#### Why TipTap?

- It already supports the editing basics I needed: headings, links, lists,
  tables, and tasks.
- It stores a structured document, which is more useful than treating the note
  as one plain string.
- It is customisable, so I could make it feel like part of Lumen.
- The trade-off is a larger and more involved browser component.

Useful reading:
[TipTap getting started](https://tiptap.dev/docs/editor/getting-started/overview)
and
[TipTap content](https://tiptap.dev/docs/editor/core-concepts/persistence).

If asked to show code:
[`document-editor.tsx`](../apps/web/src/components/editor/document-editor.tsx)
and [`editor-content.ts`](../apps/web/src/server/services/editor-content.ts).

### 4. Open a PDF

#### What to do

- Upload a PDF inside a workspace.
- Double-click the PDF row.
- Show that it opens without leaving the library.
- Show thumbnails, page navigation, zoom, rotation, search, and download.
- Close it and return to the workspace.

#### What to say

- “PDFs are stored with the other private library files.”
- “The viewer only loads when somebody opens a PDF, so the normal library page
  does not load all of that PDF code up front.”

#### Why Extend UI?

- [Extend UI](https://www.extend.ai/ui) is an open-source set of React
  components for document apps.
- I found it online and thought it would be fun to try instead of building a
  PDF viewer from scratch.
- It gave me a strong starting point that I could adapt to Lumen's design and
  file flow.
- The trade-off is adding a substantial PDF package to the browser, which is
  why the viewer loads only when needed.

Useful reading:
[Extend UI](https://www.extend.ai/ui),
[Supabase Storage](https://supabase.com/docs/guides/storage), and
[Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).

If asked to show code:
[`pdf-viewer-dialog.tsx`](../apps/web/src/components/library/pdf-viewer-dialog.tsx),
[`pdf-viewer.tsx`](../apps/web/src/components/extend-ui/pdf-viewer.tsx), and
[`uploads.ts`](../apps/web/src/server/services/uploads.ts).

### 5. Upload and transcribe audio

#### Before the demo

- Use a clear 10–20 second audio file.
- Start the transcription worker.
- Download the Whisper model before the interview.
- Keep the failed-job screenshot available as a backup.

#### What to do

- Upload the audio inside a workspace.
- Point out the **pending** status.
- Show the worker terminal picking up the job.
- Point out the **processing** status.
- Continue to another part of the demo while it runs.
- Return when the status becomes **done**.
- Open the transcript.
- Click a transcript segment and show the audio player jump to that moment.
- If the job fails, show the error and **Retry** instead of debugging live.

![Uploaded audio item in the workspace](demo-assets/11-recording-pending.jpg)

![Batch transcription flow](demo-assets/03-batch-transcription-flow.png)

![Failed transcription with retry action](demo-assets/12-transcription-failed.jpg)

#### What to say

- “The audio is uploaded to private Supabase Storage.”
- “Speech-to-text can take a while, so the app creates a background job instead
  of making the website wait.”
- “A separate worker picks up that job and runs Whisper.”
- “The visible states—pending, processing, done, or failed—tell the user what is
  happening.”
- “Speaker labels are optional. If that part fails, the transcript can still
  succeed.”

#### Why pg-boss and Whisper?

- **pg-boss** stores background jobs in Postgres, which the project already
  uses.
- That avoided adding another queue service just for this project.
- **nodejs-whisper** provides a Node.js wrapper around the CPU version of
  Whisper.
- **FFmpeg** helps the worker deal with different audio formats.
- **CMake** is part of building the native Whisper program during setup.
- The trade-off is that the worker needs more setup, model files, CPU time, and
  a long-running process.

Useful reading:
[pg-boss](https://github.com/timgit/pg-boss),
[nodejs-whisper](https://github.com/ChetanXpro/nodejs-whisper),
[FFmpeg](https://ffmpeg.org/documentation.html),
[CMake](https://cmake.org/documentation/), and
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

If asked to show code:
[`uploads.ts`](../apps/web/src/server/services/uploads.ts),
[`transcription-jobs.ts`](../apps/web/src/server/queue/transcription-jobs.ts),
and
[`transcription-worker.ts`](../apps/web/worker/transcription-worker.ts).

### 6. Optionally show live transcription

Only run this if the browser model is already cached and microphone permission
has been tested.

![Live transcription setup](demo-assets/10-live-session.jpg)

![Live transcription flow](demo-assets/04-live-transcription-flow.png)

#### What to do

- Open a workspace.
- Select **Live session**.
- Give the session a name.
- Select **Start recording**.
- Say one or two clear sentences.
- Point out the text appearing while you speak.
- Select **Stop & save**.
- Show the saved transcript.

#### What to say

- “For live transcription, the speech model runs in the browser.”
- “The heavier work runs away from the main screen so buttons and typing can
  stay responsive.”
- “When the user saves, Lumen keeps the transcript and recording.”
- “This is more sensitive to the device and the first model download, so batch
  transcription is the safer demo path.”

#### Why Transformers.js and a Web Worker?

- **Transformers.js** can run supported machine-learning models in the browser.
- A **Web Worker** provides a background browser thread for heavier work.
- This lets the user see text while speaking without sending each audio window
  to a transcription API.
- The trade-off is a large model download and performance that varies by
  device.

Useful reading:
[Transformers.js](https://huggingface.co/docs/transformers.js/index) and
[MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

If asked to show code:
[`asr-worker.ts`](../apps/web/src/lib/transcription/asr-worker.ts),
[`live-session-capture.tsx`](../apps/web/src/components/transcripts/live-session-capture.tsx),
and [`live-sessions.ts`](../apps/web/src/server/services/live-sessions.ts).

### 7. Search

#### What to do

- Search for `mitochondria`.
- Point out the matching note.
- Open the result.
- Show that Lumen takes the user straight to the note.

![Seeded full-text search result](demo-assets/09-search.jpg)

#### What to say

- “The normal search looks for matching words in titles, notes, and
  transcripts.”
- “The project also has groundwork for meaning-based search, but the search box
  shown here deliberately uses the simpler word-based path.”

#### Why Postgres search?

- The content already lives in Postgres, so its built-in text search was a
  practical starting point.
- **pgvector** leaves room for meaning-based search without adding a separate
  vector database.
- The trade-off is that the current search screen mostly needs the same words
  the user typed.

Useful reading:
[Postgres full-text search](https://www.postgresql.org/docs/current/textsearch.html)
and [pgvector](https://github.com/pgvector/pgvector).

If asked to show code:
[`search.ts`](../apps/web/src/server/services/search.ts).

## Close the walkthrough honestly

### Limits I would mention

- **Batch transcription is not always on the user's own computer.** Production
  runs the worker on Railway and stores audio in Supabase.
- **Live transcription runs locally while recording, but saving uploads the
  finished recording.**
- **The normal search screen is word-based today.**
- **Speaker labels can be wrong.** They are useful hints, not guaranteed
  identities.
- **Realtime collaboration is not built.**
- **The worker has powerful database access.** Its jobs must always stay tied
  to the correct user.

### What I left for later

- **An in-app AI assistant.** It moved out of scope because I did not feel like
  building it yet.
- I wanted the library, notes, files, transcription, tagging, and search to be
  dependable first.
- The code is organised so another client or feature can reuse the same core
  rules later.

## Testing and GitHub Actions

Use this section if the interviewer asks how the project is checked.

### What to show

- Run `bun run check`.
- Point out that it checks formatting, TypeScript, and the fast test suite.
- Open the GitHub Actions workflow if it is useful.
- Show that the faster quality job runs before the browser tests.
- Explain that failed browser runs keep reports and traces for debugging.

```bash
# Fast, database-free checks
bun run check

# Real browser flows against local Supabase
bun run test:e2e
```

### What to say

- “I use fast tests for most rules and components.”
- “I keep a smaller Playwright suite for the important real-browser flows.”
- “That gives quick feedback without pretending a fake browser can prove that
  login, routing, and Supabase all work together.”

### Why these testing tools?

- **Vitest** is the fast test runner for TypeScript rules, services, workers,
  routes, and components.
- **React Testing Library** encourages tests based on what a user can see,
  click, and read rather than private component details.
- **Playwright** opens a real browser, so it can check login, navigation,
  network requests, and mobile layouts.
- **React Doctor** adds a separate review for common React, accessibility,
  performance, and architecture problems.
- **Biome and TypeScript** catch source and type problems before the tests run.
- The trade-off is maintaining several layers. Real browser tests are slower,
  so they focus on the most valuable journeys.

Useful reading:
[Vitest](https://vitest.dev/guide/),
[Testing Library principles](https://testing-library.com/docs/guiding-principles/),
[Playwright](https://playwright.dev/docs/intro),
[GitHub Actions](https://docs.github.com/en/actions),
[Biome](https://biomejs.dev/guides/getting-started/), and
[React Doctor](https://www.react.doctor/ci).

If asked to show code:
[`vitest.config.ts`](../apps/web/vitest.config.ts),
[`playwright.config.ts`](../apps/web/playwright.config.ts),
[`library-happy-path.spec.ts`](../apps/web/e2e/library-happy-path.spec.ts),
[`ci.yml`](../.github/workflows/ci.yml), and
[`react-doctor.yml`](../.github/workflows/react-doctor.yml).

### What the GitHub pipeline does

- A pull request or push to `main` starts the quality job.
- That job installs the locked dependencies and runs `bun run check`.
- If it passes, the E2E job starts Supabase, installs Chromium, and runs
  Playwright.
- Failed Playwright runs upload their report and traces for seven days.
- A separate React Doctor workflow reviews changed React files.
- New commits cancel older in-progress runs.

### CI versus deployment

- The GitHub workflow is **continuous integration**: it checks whether a commit
  is healthy.
- It is not a complete GitHub-controlled deployment pipeline.
- The app and marketing site are prepared for Vercel.
- The transcription worker is prepared for Railway.
- Production setup and smoke testing are documented separately.

Deployment reference:
[`DEPLOY.md`](exec-plans/completed/production/prod-readiness/DEPLOY.md).

## Local setup before the demo

### One-time requirements

- Bun 1.3.14
- Docker Desktop or Podman
- CMake
- FFmpeg
- Chromium for Playwright

```bash
bun install --frozen-lockfile
bunx playwright install chromium

cd apps/web
bunx supabase start
bunx supabase db reset
bunx supabase status
```

### Local environment

- Create `apps/web/.env.local` from `.env.example`.
- Map the values printed by `supabase status -o env`:
  - `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`
  - `DB_URL` → `PG_BOSS_DATABASE_URL`
- Keep `DIARIZATION_ENABLED=false` for the safest interview demo.

### Start the app

```bash
# Terminal 1
cd apps/web
bun run worker:download-model
bun run dev

# Terminal 2
cd apps/web
bun run worker:transcribe
```

- Open `http://localhost:3000`.
- Resetting the local database recreates the demo user and seeded biology note.

### Optional live-session test

The live recording test is skipped by default because it needs a fake
microphone file and downloads a browser Whisper model.

```bash
cd apps/web
LIVE_SESSION_E2E=1 \
LIVE_SESSION_WAV=/absolute/path/to/clear-speech.wav \
bun run test:e2e e2e/live-session.spec.ts
```

## Pre-demo checklist

- [ ] Run `bun run check`.
- [ ] Run `bun run test:e2e`.
- [ ] Reset Supabase and confirm the seed login.
- [ ] Confirm `cmake --version` and `ffmpeg -version` work.
- [ ] Pre-download the batch Whisper model.
- [ ] Start the web app and worker in separate terminals.
- [ ] Upload the exact PDF and audio file you will use.
- [ ] Confirm the PDF viewer opens.
- [ ] Confirm transcript status reaches **done**.
- [ ] Confirm search opens the seeded note.
- [ ] Keep the screenshots and flow images open as a fallback.
- [ ] Do not reset the database during the interview.

If batch transcription is slow, continue with notes or search and return to the
recording later. The background job is meant to let the rest of the app keep
working.
