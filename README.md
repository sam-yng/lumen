# ✦ Lumen

### Turn lectures into a searchable study system.

*Capture everything. Transcribe locally. Find anything. Reason over all of it.*

`Next.js 16` · `React 19` · `TypeScript (strict)` · `Supabase + RLS` · `Bun + Turborepo` · `Whisper` · `MCP`

---

## What is this?

Lumen is a private study workspace for people who collect more lecture
material than they can actually find again. One nested library holds your
folders, rich-text notes, uploaded files, audio, and transcripts — and a
single search box that reaches across all of it, by **meaning**, not just by
keyword.

You record a seminar. Lumen transcribes it **on your own machine** — no audio
ever leaves for a third-party API. The transcript drops into the same library
as your notes, gets chunked and indexed, and becomes searchable next to
everything else. Later you half-remember "that thing about diffusion the prof
mentioned" — hybrid retrieval surfaces the exact segment, deep-links you to the
moment in the audio, and (with your own Claude key) an assistant can reason
over the whole workspace and **cite the sources it used**.

It's the study app I wished existed, built properly instead of quickly.

---

## The good stuff

**One library for the whole course** — Nested folders, rich-text notes,
files, recordings, transcripts, and tags living together, instead of scattered
across five apps that don't talk to each other.

**Transcription that stays yours** — Batch-transcribe uploaded audio or
capture a live session straight in the browser. CPU Whisper runs **locally** by
design; your recordings don't get shipped to anyone's cloud.

**It knows who's talking** — Optional local speaker diarization labels
segments by speaker, for both uploaded recordings and finalized live sessions —
ONNX models, on-device, degrade-never-fail.

**Search by the idea, not the wording** — Full-text **and** semantic vector
retrieval, fused. Remember the concept, find the sentence. Click a result and
land on the exact transcript segment with the audio cued to the millisecond.

**An assistant that shows its work** — Bring your own Claude key and ask
questions across your notes and transcripts. Every answer carries grounded
`[S#]` citations you can click straight through to the source. No vibes, no
hand-waving.

**Same tools, inside and out** — The assistant talks to your workspace
through an **MCP** server — the exact same tool contract is exposed to external
hosts. Your study workspace is an agent-ready surface.

---

## How it works

```
   capture  ──▶  transcribe  ──▶  index  ──▶  retrieve & reason
  notes,          local CPU       chunks +     hybrid search +
  files,          Whisper /       pgvector     cited Claude-key
  recordings      live browser    embeddings   assistant (MCP)
```

1. **Capture.** Drop in readings, recordings, files, and notes — organized in
  nested folders from minute one.
2. **Transcribe.** Run batch transcription on your machine, or capture live
  text in the browser; both finalize into one transcript path.
3. **Retrieve & reason.** Search lexically and semantically, then let the
  assistant work through your own MCP-backed study tools — with citations.

---

## Under the hood

- **All-TypeScript monorepo** — Bun workspaces + Turborepo. An authenticated
app (`apps/web`), a static marketing site (`apps/marketing`), and shared
design tokens (`packages/ui`). One `bun run check` gate rules them all:
Biome + typecheck + tests, enforced by a pre-commit hook **and** CI.
- **Next.js 16, App Router** — Server Components and thin server actions over a
**framework-agnostic service layer**. The same services back the UI today and
the MCP server for agents — clean seams, not stubs. (Yes, `middleware` is
`proxy` now. Welcome to Next 16.)
- **Security is the data model** — Supabase Postgres with **Row-Level Security
as the isolation boundary**, so multi-tenancy is enforced in the database, not
hopefully-in-the-app. The transcription worker runs with the service role and
bypasses RLS — so it scopes **every** query by `user_id`, on purpose, in
writing.
- **Background work** — pg-boss jobs for transcription, diarization, live-session
speaker labeling, and a cron sweep that finalizes abandoned live recordings.
- **Local-first AI** — `nodejs-whisper` for transcription, sherpa-onnx for
diarization, pgvector + local embeddings for hybrid retrieval. Cloud inference
is opt-in and runs on **your** Claude key, stored server-side, encrypted at
rest, never shown again.
- **Built behind a harness** — TDD where it counts, Playwright smoke tests on
every PR, design + product + reliability docs kept in the same change as the
code they describe. If it isn't in the repo, it doesn't exist.

Want the real map? Start at [AGENTS.md](AGENTS.md), then
[ARCHITECTURE.md](ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

---

**Lumen** — built all-TypeScript on Next.js 16 + Supabase, in a Bun workspace.

*Build a study workspace that keeps context close*: folders, rich notes, uploaded files, transcripts, tags, and fast full-text recall*.*