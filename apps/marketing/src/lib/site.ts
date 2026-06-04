/**
 * Canonical marketing-site config + landing-page content. URLs are
 * environment-overridable so the same build serves localhost in dev and the
 * real origins in production — set NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL
 * there. See .env.example.
 */
export const siteConfig = {
  name: "Lumen",
  tagline: "Your study workspace, all in one place.",
  description:
    "Nest your notes in folders, upload lectures, transcribe them locally, and search across everything — one calm, private home for how you study.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const features = [
  {
    title: "Nested library",
    body: "Organise everything in folders within folders — notes, files, and recordings live side by side.",
  },
  {
    title: "Rich-text notes",
    body: "Write with a fast, structured editor: headings, lists, tables, and links that stay out of your way.",
  },
  {
    title: "Local transcription",
    body: "Upload a lecture or seminar and transcribe it on your own CPU. No audio leaves your machine to be processed.",
  },
  {
    title: "Transcript viewing",
    body: "Read transcripts alongside the source recording, ready to revisit and reference while you study.",
  },
  {
    title: "Tagging",
    body: "Tag anything and pull related material back together across the whole library in seconds.",
  },
  {
    title: "Full-text search",
    body: "Search across notes, files, and transcripts at once — find the one line you remember, instantly.",
  },
] as const;

export const steps = [
  {
    n: "01",
    title: "Capture",
    body: "Drop in lecture recordings, files, and notes — organised in nested folders from day one.",
  },
  {
    n: "02",
    title: "Transcribe locally",
    body: "Turn audio into searchable text on your own machine. No audio leaves your computer to be processed.",
  },
  {
    n: "03",
    title: "Find anything",
    body: "Full-text search across notes, files, and transcripts. Tag and pull related material together.",
  },
] as const;

export const trustBadges = [
  "Local transcription",
  "Private by default",
  "Search everything",
  "Free to start",
] as const;
