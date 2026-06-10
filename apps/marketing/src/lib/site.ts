/**
 * Canonical marketing-site config + landing-page content. URLs are
 * environment-overridable so the same build serves localhost in dev and the
 * real origins in production — set NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL
 * there. See .env.example.
 */
export const siteConfig = {
  name: "Lumen",
  tagline: "Turn lectures into a searchable study system.",
  description:
    "Capture notes, files, and recordings in one private workspace, transcribe lectures locally or live, search with hybrid retrieval, and use a Claude-key assistant when you want AI help.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const features = [
  {
    title: "One library for the whole course",
    body: "Nest folders, notes, files, recordings, transcripts, and tags together instead of scattering study material across five tools.",
  },
  {
    title: "Notes built for recall",
    body: "Write structured study notes with headings, lists, tables, and links, then keep them beside the lecture evidence they came from.",
  },
  {
    title: "Local and live transcription",
    body: "Upload recorded audio for batch transcription, or capture live sessions in the browser. Audio processing stays local by design.",
  },
  {
    title: "Hybrid search over everything",
    body: "Combine full-text search with semantic retrieval across notes and transcript chunks, so the answer can surface even when you remember the idea, not the wording.",
  },
  {
    title: "Assistant over your workspace",
    body: "Ask about notes, transcripts, documents, and tags through the same MCP tool contract exposed to external hosts.",
  },
  {
    title: "Bring your Claude key",
    body: "AI inference currently runs with your own Claude API key. Lumen stores it server-side, encrypted at rest, and the key is never shown again.",
  },
] as const;

export const steps = [
  {
    n: "01",
    title: "Capture",
    body: "Drop in readings, lecture recordings, files, and notes — organised in nested folders from day one.",
  },
  {
    n: "02",
    title: "Transcribe",
    body: "Run batch transcription on your machine or capture live text in the browser, then finalize into the same transcript path.",
  },
  {
    n: "03",
    title: "Retrieve and reason",
    body: "Search lexically and semantically, then ask the Claude-key assistant to work through your own MCP-backed study tools.",
  },
] as const;

export const trustBadges = [
  "Local-first transcription",
  "Hybrid retrieval",
  "MCP-backed AI",
  "Claude key required for AI",
] as const;
