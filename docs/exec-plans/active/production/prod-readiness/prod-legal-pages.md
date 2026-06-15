# Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Path note after the monorepo migration:** this plan was written before the
> app moved into `apps/web`. Treat app paths such as `src/`, `supabase/`,
> `worker/`, `scripts/`, and `next.config.ts` as relative to `apps/web/`.
> App-local commands such as `bun run dev`, `bun run db:types`, and
> `bunx supabase ...` should run from `apps/web`; the root `bun run check`
> remains the workspace gate.

**Goal:** Ship publicly reachable `/privacy` and `/terms` pages with real first-draft copy tailored to Lumen (a study workspace that stores user-uploaded files + audio and runs local transcription), wired into the footer, with placeholders only for the legal-entity details a human must supply.

**Architecture:** Two static Server Component routes under a shared public-legal layout, plus a small `LegalFooter` linked from the app shell and the auth screens. Routes are added to the proxy's public prefixes so they're viewable logged-out. Copy embeds the data-handling reality of the app (Supabase storage, Railway worker, Sentry, Google OAuth, SMTP) and the rights from GDPR/CCPA; an explicit non-lawyer disclaimer is included.

**Tech Stack:** Next.js 16 App Router Server Components, Tailwind, shadcn/ui.

> ⚠️ **This copy is a first draft, not legal advice.** A qualified lawyer must
> review before launch — especially if Lumen will be marketed to schools or
> users under 13/16 (FERPA/COPPA change the requirements materially; the 2025
> COPPA amendments treat audio recordings and voiceprints as protected personal
> information). The draft positions Lumen as a **general-audience tool not
> directed to children under 13**, which is the simplest compliant posture.
> See [studentprivacy.ed.gov](https://studentprivacy.ed.gov/) and the FTC
> [COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa).

## Scope refinement — 2026-06-12 (binding; corrects drift since 2026-06-04)

1. **The privacy copy is no longer accurate about third-party AI.** Since v2,
   the in-app assistant sends question context (note/transcript excerpts) to
   **Anthropic's Claude API**, under a user-supplied API key stored in
   Supabase Vault. The drafted "audio is not sent to a third-party
   transcription service" stays true, but the policy must add Anthropic as a
   sub-processor *for users who enable the assistant*, state that assistant
   queries include content excerpts, and note the key is the user's own.
   Without this the policy materially misdescribes data flows.
2. **Layout snippets predate the frontend overhaul** (mobile-first,
   2026-06-11). Re-derive the footer insertions against the current
   `(app)`/`(auth)` layouts; treat the JSX as intent.
3. **`PUBLIC_PREFIXES` now contains `"/api/mcp"`** — add `/privacy` +
   `/terms` to the existing array; don't paste the snippet literally.
4. **`apps/marketing` exists now** — its footer should link to the app's
   `/privacy` and `/terms` (absolute, via the site's `appUrl`). One-line
   addition to `apps/marketing/src/components/site-footer.tsx`.
5. **Sequencing:** not on the Monday launch-test critical path (private
   seminar test, no public users) — required before opening to anyone else.

## Placeholders a human MUST fill (search for `{{…}}`)

- `{{LEGAL_ENTITY}}` — the operating company / individual name.
- `{{CONTACT_EMAIL}}` — privacy/support contact.
- `{{JURISDICTION}}` — governing-law state/country.
- `{{EFFECTIVE_DATE}}` — date of publication.
- `{{COMPANY_ADDRESS}}` — postal address (required by some laws / GDPR).

## File map

- Create: `src/app/(legal)/layout.tsx` — centered prose layout.
- Create: `src/app/(legal)/privacy/page.tsx`.
- Create: `src/app/(legal)/terms/page.tsx`.
- Create: `src/components/legal-footer.tsx`.
- Modify: `src/proxy.ts` — add `/privacy`, `/terms` to `PUBLIC_PREFIXES`.
- Modify: `src/app/(app)/layout.tsx` — render `<LegalFooter />`.
- Modify: `src/app/(auth)/layout.tsx` — render `<LegalFooter />`.

---

### Task 1: Legal layout + footer + proxy

**Files:** `src/app/(legal)/layout.tsx`, `src/components/legal-footer.tsx`,
`src/proxy.ts`.

- [ ] **Step 1: Create the legal layout**

```tsx
// src/app/(legal)/layout.tsx
import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="mb-8">
        <Link href="/" className="font-semibold">
          Lumen
        </Link>
      </header>
      <article className="prose prose-sm max-w-none dark:prose-invert">
        {children}
      </article>
    </div>
  );
}
```

> If the Tailwind typography plugin (`prose`) isn't installed, drop the
> `prose*` classes and the page still renders with default styling. Verify
> against the repo's Tailwind config; do not add the plugin just for this.

- [ ] **Step 2: Create the footer**

```tsx
// src/components/legal-footer.tsx
import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
      <Link href="/privacy" className="underline">
        Privacy
      </Link>
      <span className="mx-2">·</span>
      <Link href="/terms" className="underline">
        Terms
      </Link>
    </footer>
  );
}
```

- [ ] **Step 3: Make the routes public in `src/proxy.ts`**

```ts
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/forgot-password",
  "/privacy",
  "/terms",
];
```

> **Conflict flag:** `src/proxy.ts` is also edited by the auth plan
> (`/forgot-password`). Land both together or merge the array carefully.

- [ ] **Step 4: Render the footer in both shells**

In `src/app/(app)/layout.tsx`, add `import { LegalFooter } from "@/components/legal-footer";`
and render `<LegalFooter />` after the `<main>`:

```tsx
      <main className="flex min-h-0 flex-1">{children}</main>
      <LegalFooter />
```

In `src/app/(auth)/layout.tsx`, wrap so the footer sits at the bottom:

```tsx
import { LegalFooter } from "@/components/legal-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}
```

- [ ] **Step 5: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(legal)/layout.tsx" src/components/legal-footer.tsx src/proxy.ts "src/app/(app)/layout.tsx" "src/app/(auth)/layout.tsx"
git commit -m "feat(legal): legal layout, footer links, public routes"
```

---

### Task 2: Privacy Policy page

**Files:** `src/app/(legal)/privacy/page.tsx`.

- [ ] **Step 1: Create the page with the drafted copy**

```tsx
// src/app/(legal)/privacy/page.tsx
export const metadata = { title: "Privacy Policy — Lumen" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <em>Effective date: {"{{EFFECTIVE_DATE}}"}</em>
      </p>
      <p>
        This Privacy Policy explains how {"{{LEGAL_ENTITY}}"} ("Lumen", "we",
        "us") collects, uses, and protects your information when you use the
        Lumen study workspace. This document is provided for transparency and is
        not a substitute for legal advice.
      </p>

      <h2>Who this service is for</h2>
      <p>
        Lumen is a general-audience productivity tool and is{" "}
        <strong>not directed to children under 13</strong>. We do not knowingly
        collect personal information from children under 13. If you believe a
        child has provided us information, contact{" "}
        {"{{CONTACT_EMAIL}}"} and we will delete it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> Your email address and an
          encrypted password, or, if you sign in with Google, the basic profile
          identifiers Google shares with us.
        </li>
        <li>
          <strong>Content you upload.</strong> Notes, documents, files, tags,
          folders, and audio recordings you add to your workspace.
        </li>
        <li>
          <strong>Derived content.</strong> Text transcripts we generate from
          your audio recordings using on-device speech-to-text processing.
        </li>
        <li>
          <strong>Technical data.</strong> Limited logs and error reports needed
          to operate and secure the service.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the workspace and its features (storage, search, transcription).</li>
        <li>To authenticate you and keep your account secure.</li>
        <li>To diagnose errors and improve reliability.</li>
        <li>To communicate with you about your account (e.g. confirmation and password-reset emails).</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we do not
        use your uploaded content or transcripts to train machine-learning
        models.
      </p>

      <h2>How your data is processed and stored</h2>
      <p>
        Your content is isolated per user and protected by database
        row-level-security policies so that only you can access your rows. We use
        the following service providers ("sub-processors") to operate Lumen:
      </p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>Railway</strong> — the background transcription worker.</li>
        <li><strong>Sentry</strong> — error monitoring (does not receive your content).</li>
        <li><strong>Google</strong> — optional sign-in.</li>
        <li><strong>Resend</strong> — to deliver account emails (confirmation and password-reset links).</li>
      </ul>
      <p>
        Audio recordings are transcribed by a speech-to-text process we run
        ourselves; the audio is not sent to a third-party transcription service.
        Temporary copies created during transcription are deleted afterward.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep your content for as long as your account is active. When you
        delete content, or your account, we remove the associated data from our
        active systems; residual copies in backups are purged on our standard
        backup rotation.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (including under the EU/UK GDPR and the
        California CCPA), you may have the right to access, correct, export, or
        delete your personal information, and to restrict or object to certain
        processing. To exercise these rights, contact {"{{CONTACT_EMAIL}}"}. You
        may also delete content directly within the app.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures including encrypted transport,
        per-user access controls, and row-level-security. No system is perfectly
        secure, but we work to protect your information and will notify affected
        users of a material breach as required by law.
      </p>

      <h2>International users</h2>
      <p>
        Your information may be processed in countries other than your own. Where
        required, we rely on appropriate safeguards for such transfers.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy. Material changes will be announced in the app
        or by email, and the effective date above will be updated.
      </p>

      <h2>Contact</h2>
      <p>
        {"{{LEGAL_ENTITY}}"}, {"{{COMPANY_ADDRESS}}"} — {"{{CONTACT_EMAIL}}"}.
      </p>
    </>
  );
}
```

- [ ] **Step 2: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 3: Verify it renders**

`bun run dev`, visit `/privacy` while logged out → page loads (proxy allows it).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(legal)/privacy/page.tsx"
git commit -m "feat(legal): privacy policy draft"
```

---

### Task 3: Terms of Service page

**Files:** `src/app/(legal)/terms/page.tsx`.

- [ ] **Step 1: Create the page with the drafted copy**

```tsx
// src/app/(legal)/terms/page.tsx
export const metadata = { title: "Terms of Service — Lumen" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        <em>Effective date: {"{{EFFECTIVE_DATE}}"}</em>
      </p>
      <p>
        These Terms govern your use of Lumen, provided by {"{{LEGAL_ENTITY}}"}.
        By creating an account or using the service, you agree to these Terms. If
        you do not agree, do not use Lumen.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 13 years old (or 16 in the European Union) to use
        Lumen. By using the service you represent that you meet this requirement.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for the activity under your account and for keeping
        your credentials secure. Notify {"{{CONTACT_EMAIL}}"} of any unauthorized
        use.
      </p>

      <h2>Your content</h2>
      <p>
        You retain ownership of the notes, files, audio, and other content you
        upload ("Your Content"). You grant us a limited license to store,
        process, and display Your Content solely to operate the service for you —
        including generating transcripts from your audio. We do not claim
        ownership of Your Content and do not use it to train machine-learning
        models.
      </p>
      <p>
        You are responsible for ensuring you have the right to upload Your
        Content, including any recordings of other people, and for complying with
        applicable recording-consent laws.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload unlawful content or content that infringes others' rights;</li>
        <li>attempt to access other users' data or breach the service's security;</li>
        <li>abuse, overload, or disrupt the service or its transcription resources;</li>
        <li>use the service to violate any applicable law.</li>
      </ul>

      <h2>Transcription accuracy</h2>
      <p>
        Automated transcripts are provided "as is" and may contain errors. Do not
        rely on them for any purpose requiring verified accuracy.
      </p>

      <h2>Service availability</h2>
      <p>
        We aim to keep Lumen available but do not guarantee uninterrupted
        service, and we may modify or discontinue features.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using Lumen and delete your account at any time. We may
        suspend or terminate accounts that violate these Terms.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available" without warranties of
        any kind, to the fullest extent permitted by law.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {"{{LEGAL_ENTITY}}"} will not be
        liable for indirect, incidental, or consequential damages, or for loss of
        data, arising from your use of the service.
      </p>

      <h2>Governing law</h2>
      <p>These Terms are governed by the laws of {"{{JURISDICTION}}"}.</p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms; material changes will be announced in the app
        or by email, and continued use after changes means you accept them.
      </p>

      <h2>Contact</h2>
      <p>{"{{LEGAL_ENTITY}}"} — {"{{CONTACT_EMAIL}}"}.</p>
    </>
  );
}
```

- [ ] **Step 2: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 3: Verify it renders**

Visit `/terms` logged out → loads.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(legal)/terms/page.tsx"
git commit -m "feat(legal): terms of service draft"
```

---

## Self-review notes

- **Spec coverage:** routes ✅(T1), Privacy ✅(T2), Terms ✅(T3), footer links
  ✅(T1), full drafted content ✅ (not scaffold).
- **Standards reflected:** GDPR/CCPA rights paragraph; COPPA posture (not
  directed to under-13, audio-as-personal-data acknowledged); FERPA flagged in
  the header for the schools case; named sub-processors (a 2025-COPPA-style
  expectation and a GDPR transparency requirement).
- **Placeholders:** every human-supplied value is a `{{…}}` token, listed at the
  top — none are silent "TODO"s buried in prose.
- **Promises that need backing code (flag → prod-readiness index nice-to-haves):**
  the policy promises self-serve content + account deletion and data export. The
  app has per-item delete, but **self-serve account deletion and full export are
  not yet built** — ship those (already listed in the index nice-to-haves) or
  soften the wording before relying on it.
- **Conflict flag:** `src/proxy.ts`, `(app)/layout.tsx`, `(auth)/layout.tsx`
  shared with the auth plan — merge the `PUBLIC_PREFIXES` array and footer
  insertion carefully.
