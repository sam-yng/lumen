# Production Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take auth from "works locally with confirmations off" to production-grade: email confirmation, password reset, Google OAuth, and app-level rate limiting on abuse/cost-sensitive actions.

**Architecture:** Keep the existing server-action + `@supabase/ssr` cookie model. Add the two route handlers the PKCE flow needs (`/auth/confirm` for email-link OTP via `verifyOtp`, `/auth/callback` for OAuth code exchange via `exchangeCodeForSession`). Build redirect URLs from `NEXT_PUBLIC_APP_URL` (added by the env/deploy plan). Add a reusable Postgres-backed rate limiter applied at the service-layer enqueue seam and the password-reset action.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, Supabase Auth (PKCE), zod, Postgres (rate-limit table).

**Depends on:** `prod-env-and-deploy.md` Task 1 (`NEXT_PUBLIC_APP_URL`). Build that first.

---

## External prerequisites (dashboard, not code)

- **SMTP provider** wired in Supabase → Auth → SMTP (e.g. Resend). Built-in
  email is rate-limited to a few/hour and won't work for real signups.
- Supabase → Auth → **URL Configuration**: Site URL = `NEXT_PUBLIC_APP_URL`;
  add `${NEXT_PUBLIC_APP_URL}/auth/confirm` and `${NEXT_PUBLIC_APP_URL}/auth/callback`
  to the redirect allowlist.
- Supabase → Auth → Providers → **Google**: enable, paste the OAuth client
  ID/secret from the [Google Cloud console](https://console.cloud.google.com/apis/credentials);
  set the authorized redirect URI to the Supabase project's
  `…/auth/v1/callback`.

## File map

- Modify: `supabase/config.toml` — `enable_confirmations = true` (+ document).
- Modify: `src/proxy.ts` — `/auth` already public; no change needed (verify).
- Modify: `src/server/auth/actions.ts` — confirmation redirect, OAuth + reset
  actions.
- Create: `src/app/auth/confirm/route.ts` — email OTP verification.
- Create: `src/app/auth/callback/route.ts` — OAuth code exchange.
- Create: `src/app/(auth)/forgot-password/page.tsx` + action wiring.
- Create: `src/app/(auth)/reset-password/page.tsx` — set new password.
- Create: `src/components/forgot-password-form.tsx`,
  `src/components/reset-password-form.tsx`.
- Modify: `src/components/auth-form.tsx` — Google button + "Forgot password?"
  link + "check your email" success state.
- Create: `supabase/migrations/<ts>_rate_limits.sql` — rate-limit table + RPC.
- Create: `src/server/services/rate-limit.ts` + `…/__tests__/rate-limit.test.ts`.
- Modify: `src/server/services/uploads.ts`, `src/server/services/recordings.ts`
  — apply the limiter at enqueue.

---

### Task 1: Email confirmation route + signup "check your email" state

**Files:**
- Create: `src/app/auth/confirm/route.ts`
- Modify: `src/server/auth/actions.ts`
- Modify: `src/components/auth-form.tsx`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Create the email-confirmation route handler**

The Supabase email link carries `token_hash` + `type`; verify it server-side
(this is the canonical `@supabase/ssr` email flow — `verifyOtp`, not
`exchangeCodeForSession`).

```ts
// src/app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/server/db/client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirm", origin));
}
```

- [ ] **Step 2: Update `signUp` to send the confirmation redirect and report a pending state**

In `src/server/auth/actions.ts`, change `AuthState` and `signUp`:

```ts
import { getPublicEnv } from "@/server/config/env";

export type AuthState =
  | { error: string }
  | { status: "check-email" }
  | undefined;
```

```ts
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabase();
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/confirm?next=/`,
    },
  });
  if (error) return { error: error.message };

  // With confirmations ON, no session yet — tell the user to check email.
  return { status: "check-email" };
}
```

> Note: `signIn` keeps its `redirect("/")`. Only `signUp` changes (no immediate
> session once confirmations are on).

- [ ] **Step 3: Render the "check your email" state in `auth-form.tsx`**

After the `const copy = COPY[mode];` line, add:

```tsx
  if (state && "status" in state && state.status === "check-email") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to finish creating your account.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
```

And guard the existing error render (it now must check the variant):

```tsx
          {state && "error" in state && state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
```

- [ ] **Step 4: Flip confirmations on in `supabase/config.toml`**

Change `enable_confirmations = false` to `true` under `[auth.email]`. Add a
comment: `# prod requires SMTP wired in the dashboard (see prod-auth.md)`.

- [ ] **Step 5: Run the gate**

Run: `bun run check`
Expected: green (types must still compile with the new `AuthState` union).

- [ ] **Step 6: Manual verification** (project rule: run the happy path)

`bunx supabase start`, `bun run dev`, sign up with a new email → see "Check your
email" → open the link in Inbucket (`http://127.0.0.1:54324`) → redirected to
`/` logged in.

- [ ] **Step 7: Commit**

```bash
git add src/app/auth/confirm/route.ts src/server/auth/actions.ts src/components/auth-form.tsx supabase/config.toml
git commit -m "feat(auth): email confirmation flow"
```

---

### Task 2: OAuth callback route (code exchange)

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the callback handler**

```ts
// src/app/auth/callback/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/server/db/client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", origin));
}
```

- [ ] **Step 2: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): OAuth code-exchange callback route"
```

---

### Task 3: Password reset (request + set-new-password)

**Files:**
- Modify: `src/server/auth/actions.ts`
- Create: `src/components/forgot-password-form.tsx`
- Create: `src/components/reset-password-form.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Add reset actions to `actions.ts`**

```ts
const emailSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const supabase = await createServerSupabase();
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  // Recovery link lands on /auth/confirm (type=recovery) which establishes a
  // session, then forwards to /reset-password to set a new password.
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password` },
  );
  if (error) return { error: error.message };
  return { status: "check-email" };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  redirect("/");
}
```

- [ ] **Step 2: Create `forgot-password-form.tsx`**

```tsx
// src/components/forgot-password-form.tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/server/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    undefined,
  );

  if (state && "status" in state && state.status === "check-email") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If that address has an account, a reset link is on its way.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>We'll email you a reset link.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {state && "error" in state && state.error ? (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "…" : "Send reset link"}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="underline">Back to log in</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Create `reset-password-form.tsx`**

```tsx
// src/components/reset-password-form.tsx
"use client";

import { useActionState } from "react";
import { updatePassword } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/server/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
          </div>
          {state && "error" in state && state.error ? (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "…" : "Update password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 4: Create the two pages**

```tsx
// src/app/(auth)/forgot-password/page.tsx
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
```

```tsx
// src/app/(auth)/reset-password/page.tsx
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
```

> **Proxy note:** `/reset-password` and `/forgot-password` are under the
> `(auth)` group but NOT in `PUBLIC_PREFIXES`. `/forgot-password` must be
> reachable while logged out → add it. `/reset-password` is reached WITH a
> recovery session, so the proxy's "authenticated users kept out of auth pages"
> rule only blocks `/login` and `/signup` explicitly — verify it doesn't
> redirect `/reset-password`. See Step 5.

- [ ] **Step 5: Add `/forgot-password` to `PUBLIC_PREFIXES` in `src/proxy.ts`**

```ts
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/forgot-password"];
```

> **Conflict flag:** `src/proxy.ts` is shared. The existing redirect only
> fires for exact `/login` and `/signup`, so `/reset-password` (auth'd via
> recovery) renders fine. No change needed there.

- [ ] **Step 6: Add "Forgot password?" link to the login form**

In `src/components/auth-form.tsx`, inside the login `CardFooter`, below the alt
prompt, add (only for `mode === "login"`):

```tsx
          {mode === "login" ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/forgot-password" className="underline">
                Forgot password?
              </Link>
            </p>
          ) : null}
```

- [ ] **Step 7: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 8: Manual verification**

Request reset → open link in Inbucket → land on `/reset-password` → set new
password → redirected to `/`, logged in. Old password rejected on next login.

- [ ] **Step 9: Commit**

```bash
git add src/server/auth/actions.ts src/components/forgot-password-form.tsx src/components/reset-password-form.tsx "src/app/(auth)/forgot-password" "src/app/(auth)/reset-password" src/proxy.ts src/components/auth-form.tsx
git commit -m "feat(auth): password reset flow"
```

---

### Task 4: Google OAuth

**Files:**
- Modify: `src/server/auth/actions.ts`
- Modify: `src/components/auth-form.tsx`

- [ ] **Step 1: Add the OAuth action**

```ts
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createServerSupabase();
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/` },
  });
  if (error) {
    redirect("/login?error=oauth");
  }
  if (data.url) {
    redirect(data.url);
  }
}
```

- [ ] **Step 2: Add the Google button to `auth-form.tsx`**

In the `CardContent`, above the email field, add:

```tsx
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
```

Add the import at the top: `import { signInWithGoogle } from "@/server/auth/actions";`

> Nesting a `<form>` inside the outer credentials `<form>` is invalid HTML.
> Place the Google `<form>` BEFORE the opening `<form action={formAction}>`
> tag (just inside `CardContent` is wrong — move it above the credentials form,
> still inside the `Card`). Implementer: render the Google form as a sibling of
> the credentials form, not a descendant.

- [ ] **Step 3: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 4: Manual verification** (needs the dashboard Google provider configured)

Click "Continue with Google" → Google consent → redirected back through
`/auth/callback` → landed in app. Defer if the Google OAuth client isn't set up
yet; the route + button are still correct.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/actions.ts src/components/auth-form.tsx
git commit -m "feat(auth): Google OAuth sign-in"
```

---

### Task 5: App-level rate limiting

**Files:**
- Create: `supabase/migrations/<timestamp>_rate_limits.sql`
- Create: `src/server/services/rate-limit.ts`
- Test: `src/server/services/__tests__/rate-limit.test.ts`
- Modify: `src/server/services/uploads.ts`, `src/server/services/recordings.ts`

> **Conflict flag (migrations):** a parallel agent may also be adding
> migrations. Migration filenames are timestamp-ordered. **Generate the
> timestamp at apply time** (`supabase migration new rate_limits`) and rebase if
> another migration lands first. Never hardcode an ordinal that collides.

> **Design:** fixed-window counter keyed by `(user_id, action)`. Enforced by a
> Postgres function so the increment+check is atomic and works for both the
> RLS-scoped app client and (if ever needed) the worker. RLS restricts rows to
> the owner.

- [ ] **Step 1: Write the limiter unit test (pure window math first)**

```ts
// src/server/services/__tests__/rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { windowStart } from "../rate-limit";

describe("windowStart", () => {
  it("floors a timestamp to the window boundary", () => {
    const ts = new Date("2026-06-04T12:34:56.000Z").getTime();
    const start = windowStart(ts, 60_000);
    expect(new Date(start).toISOString()).toBe("2026-06-04T12:34:00.000Z");
  });

  it("keeps two timestamps in the same minute in one window", () => {
    const a = windowStart(Date.parse("2026-06-04T12:34:01Z"), 60_000);
    const b = windowStart(Date.parse("2026-06-04T12:34:59Z"), 60_000);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `bunx vitest run src/server/services/__tests__/rate-limit.test.ts`
Expected: FAIL — `windowStart` not exported.

- [ ] **Step 3: Create the migration**

Run `bunx supabase migration new rate_limits`, then put this in the new file:

```sql
create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

create policy "own rate limits" on public.rate_limits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomic increment-and-return for the current window. Returns the new count.
create or replace function public.bump_rate_limit(
  p_action text,
  p_window_start timestamptz
) returns integer
language plpgsql security invoker as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, p_window_start, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;
```

- [ ] **Step 4: Apply + regenerate types/schema docs**

Run:
```bash
bunx supabase db reset
bun run db:types
bun run docs:db-schema
```
Expected: `rate_limits` appears in `src/server/db/database.types.ts`.

> **Conflict flag:** `bun run docs:db-schema` regenerates
> `docs/generated/db-schema.md`. That's a generated file — if a parallel agent
> also regenerated it, re-run this after rebasing so it reflects all migrations.

- [ ] **Step 5: Implement the limiter**

```ts
// src/server/services/rate-limit.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";

/** Floor a unix-ms timestamp to its fixed window boundary. */
export function windowStart(nowMs: number, windowMs: number): number {
  return nowMs - (nowMs % windowMs);
}

export class RateLimitError extends Error {
  constructor(public readonly action: string) {
    super(`Rate limit exceeded for "${action}". Try again shortly.`);
    this.name = "RateLimitError";
  }
}

type Limit = { action: string; max: number; windowMs: number };

/**
 * Increment the caller's counter for `action` in the current window and throw
 * RateLimitError if it now exceeds `max`. Uses the user-scoped client, so the
 * RPC's auth.uid() is the authenticated user. Atomic via bump_rate_limit.
 */
export async function enforceRateLimit(
  client: SupabaseClient<Database>,
  limit: Limit,
  nowMs: number = Date.now(),
): Promise<void> {
  const start = new Date(windowStart(nowMs, limit.windowMs)).toISOString();
  const { data, error } = await client.rpc("bump_rate_limit", {
    p_action: limit.action,
    p_window_start: start,
  });
  if (error) throw error;
  if ((data ?? 0) > limit.max) throw new RateLimitError(limit.action);
}

export const LIMITS = {
  transcriptionEnqueue: {
    action: "transcription_enqueue",
    max: 20,
    windowMs: 60 * 60 * 1000, // 20 transcriptions/hour/user
  },
} as const satisfies Record<string, Limit>;
```

- [ ] **Step 6: Run the limiter test, verify it passes**

Run: `bunx vitest run src/server/services/__tests__/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 7: Apply the limiter at the enqueue seam**

In `src/server/services/uploads.ts`, before the audio-upload path calls
`enqueueTranscription`, call:

```ts
import { enforceRateLimit, LIMITS } from "@/server/services/rate-limit";
// …inside the authenticated upload path, before enqueue:
await enforceRateLimit(ctx.supabase, LIMITS.transcriptionEnqueue);
```

Do the same in `src/server/services/recordings.ts` retry path, before its
`enqueueTranscription` call. Use the user-scoped client already on the context.

> **Implementer:** match the exact context/param name these services use for the
> user-scoped client (they take an authenticated context per ARCHITECTURE.md).
> Surface `RateLimitError.message` to the route handler as a 429.

- [ ] **Step 8: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations src/server/services/rate-limit.ts src/server/services/__tests__/rate-limit.test.ts src/server/services/uploads.ts src/server/services/recordings.ts src/server/db/database.types.ts docs/generated/db-schema.md
git commit -m "feat(ratelimit): per-user transcription enqueue cap"
```

---

## Self-review notes

- **Spec coverage:** email confirmation ✅(T1), OAuth ✅(T2,T4), password reset
  ✅(T3), rate limiting ✅(T5).
- **Type consistency:** `AuthState` union (`{error}` | `{status:"check-email"}`
  | undefined) is used identically across `auth-form`, `forgot-password-form`,
  `reset-password-form`. Every consumer narrows with `"error" in state` /
  `"status" in state`.
- **Known follow-ups (out of scope, flag for later):** rate-limit cleanup job
  for old `rate_limits` rows (table grows unbounded — a periodic delete or
  pg_cron); applying the auth-action rate limit per-IP (Supabase already covers
  basic auth throttling, so deferred). Add to the prod-readiness index
  nice-to-haves if prioritised.
- **Conflict flags:** `src/proxy.ts`, `src/server/auth/actions.ts`,
  `src/components/auth-form.tsx`, M4 service files, and the generated
  `database.types.ts` / `db-schema.md` are all shared surfaces — see inline.
