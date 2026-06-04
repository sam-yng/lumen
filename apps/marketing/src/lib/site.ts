/**
 * Canonical marketing-site config. URLs are environment-overridable so the
 * same build serves localhost in dev and the real origins in production —
 * set NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL there. See .env.example.
 */
export const siteConfig = {
  name: "Lumen",
  tagline: "Your study workspace, all in one place.",
  description:
    "Lumen is a study workspace: nest your notes in folders, upload lectures, transcribe them locally, and search across everything.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
