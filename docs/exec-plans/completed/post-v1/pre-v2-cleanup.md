# Pre-v2 Cleanup Implementation Plan

> **Status: COMPLETED (2026-06-04).** All tasks actioned on `task/v1-cleanup`
> after the monorepo migration.
>
> **Retrospective:** Task 1 (auth OTP / confirm password) was already shipped in
> `c7bd793` before the migration. Tasks 2–7 landed as route-backed library /
> note / transcript / tags views, a Radix dialog + picker primitive set, a full
> workspace split into focused modules with every dead control wired and all
> `window.prompt`/`confirm` removed, an editor link dialog, tighter control
> density with responsive icon-only action bars, and an expanded Playwright
> suite (3 specs) verified green against the local Supabase stack alongside
> `bun run check`. The tag color picker shipped as a dropdown (refined from the
> originally-planned swatch radios). All paths were translated to the new
> `apps/web/` monorepo layout.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Path note after the monorepo migration:** this plan was written before the
> app moved into `apps/web`. Treat app paths such as `src/`, `supabase/`,
> `worker/`, `scripts/`, and `next.config.ts` as relative to `apps/web/`.
> App-local commands such as `bun run dev`, `bun run db:types`, and
> `bunx supabase ...` should run from `apps/web`; the root `bun run check`
> remains the workspace gate.
>
> **Design spec:** [docs/superpowers/specs/2026-06-04-pre-v2-cleanup-design.md](../../../superpowers/specs/2026-06-04-pre-v2-cleanup-design.md)

> **Task 1 already shipped (2026-06-04):** the auth OTP + confirm-password work
> landed in `c7bd793 feat(auth): require signup email code` (now in `main`).
> `verifySignUpOtp`/`otp-sent` state, the confirm-password field, the auth-form
> test, and `apps/web/supabase/templates/confirmation.html` all exist. **Skip
> Task 1 — start at Task 2.**

**Goal:** Fix the pre-v2 cleanup issues: clearer `/library` routes, full-page notes/transcripts, working library controls, preset tag colors, custom dialogs, upload selection polish, smaller responsive UI, and sign-up email OTP confirmation.

**Architecture:** Keep Supabase services/API handlers as the domain seam. Move view state that represents "where the user is" into Next 16 App Router routes, then split the large library client component into focused components that still share the existing TanStack Query snapshot and mutation helpers. Add small UI primitives locally only where the current shadcn subset is missing the necessary behavior.

**Tech Stack:** Bun, Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn-style local UI primitives, lucide-react, TanStack Query, TipTap, Supabase Auth/SSR, Vitest, Playwright.

---

## Source Material

- Approved spec: `docs/superpowers/specs/2026-06-04-pre-v2-cleanup-design.md`
- Product spec: `docs/product-specs/library-and-notes.md`
- Design references: `docs/DESIGN.md`, `docs/FRONTEND.md`
- Next 16 docs to re-read before route work:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- Installed Supabase auth types to re-check before OTP work:
  - `node_modules/@supabase/auth-js/dist/main/lib/types.d.ts`
  - `node_modules/@supabase/auth-js/src/GoTrueClient.ts`
- Current hot spots:
  - `src/components/library/library-workspace.tsx`
  - `src/components/editor/document-editor.tsx`
  - `src/components/auth-form.tsx`
  - `src/server/auth/actions.ts`
  - `src/proxy.ts`
  - `src/app/(app)/page.tsx`
  - `e2e/library-happy-path.spec.ts`

## File Structure

- Modify: `src/app/(app)/page.tsx` — redirect `/` to `/library`.
- Create: `src/app/(app)/library/page.tsx` — main library route.
- Create: `src/app/(app)/library/notes/[id]/page.tsx` — full-page note route.
- Create: `src/app/(app)/library/transcripts/[recordingId]/page.tsx` — full-page transcript route.
- Create: `src/app/(app)/library/tags/page.tsx` — tag management route.
- Modify: `src/proxy.ts` — authenticated `/login` and `/signup` redirects go to `/library`.
- Modify: `src/server/auth/actions.ts` — confirm-password validation, sign-up pending state, OTP verification, redirect targets.
- Modify: `src/components/auth-form.tsx` — confirm-password field and OTP entry state.
- Modify: `supabase/config.toml` — enable email confirmations and add local confirmation template config.
- Create: `supabase/templates/confirmation.html` — local email template that exposes a six-digit code.
- Create: `src/components/ui/dialog.tsx` — local Radix dialog primitive.
- Create: `src/components/library/library-shell.tsx` — workspace chrome and query boundary.
- Create: `src/components/library/library-sidebar.tsx` — sidebar nav, folder tree, disabled Recents, Tags link, Ask Lumen v2 affordance, footer.
- Create: `src/components/library/library-actions.tsx` — new note, new folder, upload, record action entry points.
- Create: `src/components/library/library-content.tsx` — folder/document/file sections and empty state.
- Create: `src/components/library/library-item-row.tsx` — row actions, move control, tag attach.
- Create: `src/components/library/tag-panel.tsx` — tag create/manage/filter UI.
- Create: `src/components/library/tag-color-picker.tsx` — five preset color picker.
- Create: `src/components/library/library-dialogs.tsx` — text-input and destructive-confirm dialogs.
- Create: `src/components/library/file-upload-picker.tsx` — selected-file display and clear button.
- Modify: `src/components/library/library-workspace.tsx` — shrink to compatibility wrapper or remove after route components consume extracted pieces.
- Modify: `src/components/editor/document-editor.tsx` — route page shell support and link dialog.
- Modify: `src/components/transcripts/transcript-viewer.tsx` — route page shell support.
- Modify: `src/app/globals.css`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx` — smaller density and responsive overflow fixes.
- Modify: `docs/product-specs/library-and-notes.md`, `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/SECURITY.md` — route map, disabled Recents, OTP setup notes.
- Modify: `e2e/library-happy-path.spec.ts` — route-backed happy path.
- Create focused component tests under `src/components/**/__tests__/` for auth form, tag color picker, file upload picker, and prompt-free dialog flows.

Generated files remain untouched unless a task explicitly regenerates them.

---

### Task 1: Auth OTP And Confirm Password — ✅ DONE (shipped in `c7bd793`, skip)

**Files:**
- Modify: `src/server/auth/actions.ts`
- Modify: `src/components/auth-form.tsx`
- Modify: `src/proxy.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/templates/confirmation.html`
- Test: `src/components/__tests__/auth-form.test.tsx`

- [ ] **Step 1: Re-read installed Supabase OTP types**

Run:

```bash
sed -n '650,705p' node_modules/@supabase/auth-js/dist/main/lib/types.d.ts
sed -n '2200,2222p' node_modules/@supabase/auth-js/src/GoTrueClient.ts
```

Expected: `VerifyEmailOtpParams` accepts `{ email, token, type }`, and `EmailOtpType` includes `signup` and `email`.

- [ ] **Step 2: Write failing auth-form tests**

Create `src/components/__tests__/auth-form.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthForm } from "@/components/auth-form";
import type { AuthState } from "@/server/auth/actions";

async function noopAction(
  _prev: AuthState,
  _formData: FormData,
): Promise<AuthState> {
  return undefined;
}

describe("AuthForm", () => {
  it("shows confirm password only for signup", () => {
    const { rerender } = render(<AuthForm mode="signup" action={noopAction} />);

    expect(screen.getByLabelText("Confirm password")).toBeVisible();

    rerender(<AuthForm mode="login" action={noopAction} />);

    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });

  it("renders OTP entry when signup is pending confirmation", () => {
    render(
      <AuthForm
        mode="signup"
        action={noopAction}
        initialState={{ status: "otp-sent", email: "new@lumen.test" }}
      />,
    );

    expect(screen.getByText("Check your email")).toBeVisible();
    expect(screen.getByLabelText("Confirmation code")).toBeVisible();
    expect(screen.getByDisplayValue("new@lumen.test")).toBeInTheDocument();
  });

  it("shows validation errors in the OTP state", () => {
    render(
      <AuthForm
        mode="signup"
        action={noopAction}
        initialState={{
          status: "otp-sent",
          email: "new@lumen.test",
          error: "Enter the 6-digit code.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Enter the 6-digit code.");
  });
});
```

Run:

```bash
bun run test src/components/__tests__/auth-form.test.tsx
```

Expected: fail because `AuthForm` has no `initialState`, confirm-password field, or OTP state.

- [ ] **Step 3: Implement auth state and validation**

In `src/server/auth/actions.ts`, replace the current single credentials schema with login, signup, and OTP schemas:

```ts
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signupSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

const verifySignupOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type AuthState =
  | { error: string; email?: string }
  | { status: "otp-sent"; email: string; error?: string }
  | undefined;
```

Update `signIn` to parse `loginSchema` and redirect to `/library` after success.

Update `signUp`:

```ts
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabase();
  const { email, password } = parsed.data;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  return { status: "otp-sent", email };
}
```

Add `verifySignUpOtp`:

```ts
export async function verifySignUpOtp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = verifySignupOtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  });
  if (error) return { status: "otp-sent", email: parsed.data.email, error: error.message };

  redirect("/library");
}
```

- [ ] **Step 4: Wire AuthForm OTP state**

In `src/components/auth-form.tsx`:

- Add optional prop `initialState?: AuthState`.
- Pass `initialState` as the third `useActionState` argument.
- Render confirm-password only when `mode === "signup"`.
- When `state?.status === "otp-sent"`, render a second form with:

```tsx
<Input id="email" name="email" type="email" value={state.email} readOnly />
<Input
  id="token"
  name="token"
  inputMode="numeric"
  maxLength={6}
  pattern="[0-9]{6}"
  required
/>
<Button type="submit" className="w-full" disabled={pending}>
  {pending ? "..." : "Verify email"}
</Button>
```

Use `Label htmlFor="token"` with visible text `Confirmation code`.

Import and use `verifySignUpOtp` for the OTP form. Keep the login form path unchanged. The component should use one `useActionState` hook for the login/sign-up form action and a second `useActionState` hook for `verifySignUpOtp`; render the OTP form from the latest state whose `status` is `"otp-sent"`.

- [ ] **Step 5: Configure Supabase local email OTP**

In `supabase/config.toml`, under `[auth.email]`:

```toml
# Prod requires SMTP and confirmation template wiring in the Supabase dashboard.
enable_confirmations = true
otp_length = 6
otp_expiry = 3600
```

Add:

```toml
[auth.email.template.confirmation]
subject = "Your Lumen confirmation code"
content_path = "./supabase/templates/confirmation.html"
```

Create `supabase/templates/confirmation.html`:

```html
<h2>Your Lumen confirmation code</h2>
<p>Enter this code to finish creating your workspace:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em;">{{ .Token }}</p>
<p>This code expires in one hour.</p>
```

- [ ] **Step 6: Update protected redirect targets**

In `src/proxy.ts`, change authenticated redirects from `/login` or `/signup` to `/library`, not `/`.

In `src/server/auth/actions.ts`, change successful sign-in redirects to `/library`.

- [ ] **Step 7: Verify and commit**

Run:

```bash
bun run check
```

Expected: green.

Manual check after implementation server is available:

```bash
bunx supabase start
bun run dev
```

Sign up with a new email, read the six-digit code in Inbucket at `http://127.0.0.1:54324`, enter it, and confirm redirect to `/library`.

Commit:

```bash
git add src/server/auth/actions.ts src/components/auth-form.tsx src/proxy.ts supabase/config.toml supabase/templates/confirmation.html src/components/__tests__/auth-form.test.tsx
git commit -m "feat(auth): require signup email code"
```

---

### Task 2: Route-Backed Library, Notes, Transcripts, And Tags

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/library/page.tsx`
- Create: `src/app/(app)/library/notes/[id]/page.tsx`
- Create: `src/app/(app)/library/transcripts/[recordingId]/page.tsx`
- Create: `src/app/(app)/library/tags/page.tsx`
- Modify: `src/components/library/library-workspace.tsx`
- Modify: `e2e/library-happy-path.spec.ts`

- [ ] **Step 1: Re-read Next 16 route docs**

Run:

```bash
sed -n '96,190p' node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
sed -n '223,250p' node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md
sed -n '360,374p' node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md
```

Expected: folders define route segments; route groups in parentheses do not affect URLs.

- [ ] **Step 2: Update the failing E2E route expectations**

In `e2e/library-happy-path.spec.ts`, update the login assertion:

```ts
await expect(page).toHaveURL(/\/library$/);
```

After opening the seeded note result, assert:

```ts
await expect(page).toHaveURL(/\/library\/notes\/[0-9a-f-]+$/i);
```

Then add a back-navigation assertion:

```ts
await page.getByRole("link", { name: "Back to library" }).click();
await expect(page).toHaveURL(/\/library$/);
```

Run:

```bash
bun run test:e2e -- e2e/library-happy-path.spec.ts
```

Expected: fail because `/library` and the note route do not exist yet.

- [ ] **Step 3: Redirect root to `/library`**

Replace `src/app/(app)/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/library");
}
```

- [ ] **Step 4: Create `/library` page**

Create `src/app/(app)/library/page.tsx`:

```tsx
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { signOut } from "@/server/auth/actions";
import { createServerSupabase } from "@/server/db/client";

export default async function LibraryPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LibraryWorkspace
      signOutAction={signOut}
      userEmail={user?.email ?? "Workspace member"}
      view="library"
    />
  );
}
```

Add `view?: "library" | "tags"` to `LibraryWorkspace` props. The `"tags"` view renders the extracted tag management route once Task 4 creates `TagsRoute`; before that extraction, it may render the same workspace with the tag panel focused.

- [ ] **Step 5: Create full-page note route**

Create `src/app/(app)/library/notes/[id]/page.tsx`:

```tsx
import { NoteRoute } from "@/components/library/note-route";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoteRoute documentId={id} />;
}
```

Create `src/components/library/note-route.tsx` as a client component. It uses `useQuery({ queryKey: libraryQueryKey, queryFn: fetchLibrarySnapshot })`, finds the document by id, renders a visible `Back to library` link, and passes the document to `DocumentEditor`.

- [ ] **Step 6: Create transcript and tags routes**

Create `src/components/library/transcript-route.tsx` and `src/components/library/tags-route.tsx` as client components backed by the existing library snapshot.

Create `src/app/(app)/library/transcripts/[recordingId]/page.tsx`:

```tsx
import { TranscriptRoute } from "@/components/library/transcript-route";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = await params;
  return <TranscriptRoute recordingId={recordingId} />;
}
```

Create `src/app/(app)/library/tags/page.tsx`:

```tsx
import { TagsRoute } from "@/components/library/tags-route";

export default function TagsPage() {
  return <TagsRoute />;
}
```

- [ ] **Step 7: Navigate instead of opening split panes**

In `library-workspace.tsx`, replace local document/transcript open behavior with `next/navigation` router pushes:

```ts
router.push(`/library/notes/${documentId}`);
router.push(`/library/transcripts/${recordingId}`);
```

Remove the split-grid rendering of `<DocumentEditor />` and `<TranscriptViewer />` from the library list route.

- [ ] **Step 8: Verify and commit**

Run:

```bash
bun run check
```

Expected: green.

Run E2E if Supabase local is available:

```bash
bun run test:e2e -- e2e/library-happy-path.spec.ts
```

Commit:

```bash
git add 'src/app/(app)/page.tsx' 'src/app/(app)/library' src/components/library/library-workspace.tsx src/components/library/note-route.tsx src/components/library/transcript-route.tsx src/components/library/tags-route.tsx e2e/library-happy-path.spec.ts
git commit -m "feat(library): add route-backed workspace views"
```

---

### Task 3: Dialog Primitive, Preset Colors, And Upload Picker

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/library/library-dialogs.tsx`
- Create: `src/components/library/tag-color-picker.tsx`
- Create: `src/components/library/file-upload-picker.tsx`
- Test: `src/components/library/__tests__/tag-color-picker.test.tsx`
- Test: `src/components/library/__tests__/file-upload-picker.test.tsx`

- [ ] **Step 1: Write failing tag color picker test**

Create `src/components/library/__tests__/tag-color-picker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TAG_COLOR_PRESETS, TagColorPicker } from "@/components/library/tag-color-picker";

describe("TagColorPicker", () => {
  it("submits a preset color through a hidden form value", () => {
    const onChange = vi.fn();
    render(<TagColorPicker name="color" value={TAG_COLOR_PRESETS[0].value} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: TAG_COLOR_PRESETS[2].label }));

    expect(onChange).toHaveBeenCalledWith(TAG_COLOR_PRESETS[2].value);
    expect(screen.getByDisplayValue(TAG_COLOR_PRESETS[2].value)).toHaveAttribute("name", "color");
  });
});
```

Run:

```bash
bun run test src/components/library/__tests__/tag-color-picker.test.tsx
```

Expected: fail because the component does not exist.

- [ ] **Step 2: Implement `TagColorPicker`**

Create `src/components/library/tag-color-picker.tsx`:

```tsx
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const TAG_COLOR_PRESETS = [
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#38bdf8" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Red", value: "#ef4444" },
  { label: "Violet", value: "#a78bfa" },
] as const;

export function TagColorPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex items-center gap-2" aria-label="Tag color">
      <input type="hidden" name={name} value={value} readOnly />
      {TAG_COLOR_PRESETS.map((preset) => {
        const selected = preset.value === value;
        return (
          <button
            key={preset.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={preset.label}
            title={preset.label}
            onClick={() => onChange(preset.value)}
            className={cn(
              "grid size-8 place-items-center rounded-md border border-[var(--border-soft)]",
              selected && "border-[var(--accent-line)] ring-3 ring-[var(--accent-soft)]",
            )}
            style={{ backgroundColor: preset.value }}
          >
            {selected ? <Check className="size-4 text-white" /> : null}
          </button>
        );
      })}
    </fieldset>
  );
}
```

- [ ] **Step 3: Write failing file upload picker test**

Create `src/components/library/__tests__/file-upload-picker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileUploadPicker } from "@/components/library/file-upload-picker";

describe("FileUploadPicker", () => {
  it("shows a selected file and clears it", () => {
    render(<FileUploadPicker name="file" />);
    const input = screen.getByLabelText("Choose file");
    const file = new File(["hello"], "lecture.mp3", { type: "audio/mpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("lecture.mp3")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove selected file" }));

    expect(screen.queryByText("lecture.mp3")).not.toBeInTheDocument();
  });
});
```

Run:

```bash
bun run test src/components/library/__tests__/file-upload-picker.test.tsx
```

Expected: fail because the component does not exist.

- [ ] **Step 4: Implement `FileUploadPicker`**

Create `src/components/library/file-upload-picker.tsx` with:

- A visually styled label button with upload icon.
- A hidden `<input type="file" name={name}>`.
- Local `selectedFile` state from `event.currentTarget.files?.[0]`.
- Text that shows `selectedFile.name` after selection.
- A `Trash2` icon button that sets state to `null` and clears `inputRef.current.value = ""`.

The input remains in the form, so `new FormData(form).get("file")` continues to work.

- [ ] **Step 5: Add dialog primitive**

Create `src/components/ui/dialog.tsx` using the installed `radix-ui` package:

```tsx
"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(calc(100vw-32px),420px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-pop)]",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
```

Create `library-dialogs.tsx` with `TextInputDialog` and `ConfirmDialog` wrappers around the primitive.

- [ ] **Step 6: Verify and commit**

Run:

```bash
bun run check
```

Expected: green.

Commit:

```bash
git add src/components/ui/dialog.tsx src/components/library/library-dialogs.tsx src/components/library/tag-color-picker.tsx src/components/library/file-upload-picker.tsx src/components/library/__tests__
git commit -m "feat(library): add dialog and picker primitives"
```

---

### Task 4: Split Library Workspace And Wire Broken Controls

**Files:**
- Create: `src/components/library/library-shell.tsx`
- Create: `src/components/library/library-sidebar.tsx`
- Create: `src/components/library/library-actions.tsx`
- Create: `src/components/library/library-content.tsx`
- Create: `src/components/library/library-item-row.tsx`
- Create: `src/components/library/tag-panel.tsx`
- Modify: `src/components/library/library-workspace.tsx`

- [ ] **Step 1: Move pure helpers first**

Move these from `library-workspace.tsx` into the smallest consuming files:

- `useLibraryMutation` stays in `library-api.ts` or a new `library-hooks.ts`.
- `tagsForTarget` and `tagLinkForTarget` move to `library-tags.ts`.
- `folderName` moves to `library-paths.ts`.
- `STATUS_TONE` moves beside row/status rendering.

Run:

```bash
bun run check
```

Expected: green after the mechanical extraction.

- [ ] **Step 2: Extract sidebar**

Create `library-sidebar.tsx` with props:

```ts
type LibrarySidebarProps = {
  folders: FolderRow[];
  selectedFolderId: string | null;
  userEmail: string;
  signOutAction: SignOutAction;
  onSelectFolder: (folderId: string | null) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
};
```

Wire:

- Library button navigates/selects `/library`.
- Recents button is disabled with `aria-disabled="true"` and title `Recents ship later`.
- Tags uses `Link href="/library/tags"`.
- Ask Lumen remains disabled or inert with visible `v2` badge.
- New folder calls `onCreateFolder`.

- [ ] **Step 3: Extract actions**

Create `library-actions.tsx` with:

- New note button opens `TextInputDialog`.
- Upload button opens upload dialog using `FileUploadPicker`.
- Record uses existing `RecordAudioForm`.
- Search button focuses the search panel input by dispatching a callback prop `onFocusSearch`.

- [ ] **Step 4: Extract item rows and content**

Move `ItemRow`, `MoveSelect`, `TagChips`, and `TagAttachForm` into focused files. Replace native prompt/confirm usage:

- Rename uses `TextInputDialog`.
- Delete uses `ConfirmDialog`.
- Document open calls route push.
- Transcript open calls route push.
- File rows retain rename/delete/move/tag behavior.

- [ ] **Step 5: Extract tag panel and use preset colors**

Move `TagPanel` to `tag-panel.tsx`. Replace:

```tsx
<Input name="color" placeholder="#22c55e" />
```

with controlled local state:

```tsx
const [color, setColor] = useState(TAG_COLOR_PRESETS[0].value);
<TagColorPicker name="color" value={color} onChange={setColor} />
```

Reset the color back to the default after a successful create.

- [ ] **Step 6: Keep `LibraryWorkspace` as the query boundary**

After extraction, `library-workspace.tsx` should mostly:

- Fetch `libraryQueryKey`.
- Hold `selectedFolderId` and `selectedTagId`.
- Hold dialog open state that truly spans shell/content.
- Render `LibraryShell`, `LibrarySidebar`, `LibraryActions`, `SearchPanel`, and `LibraryContent`.

It should no longer contain full item row, tag panel, upload picker, or modal implementations.

- [ ] **Step 7: Verify and commit**

Run:

```bash
rg -n "window\\.prompt|window\\.confirm|prompt\\(|confirm\\(" src/components
bun run check
```

Expected: `rg` finds no native prompt/confirm usage in components; check is green.

Commit:

```bash
git add src/components/library src/components/editor/document-editor.tsx
git commit -m "refactor(library): split workspace and wire actions"
```

---

### Task 5: Editor Link Dialog And Full-Page View Polish

**Files:**
- Modify: `src/components/editor/document-editor.tsx`
- Modify: `src/components/library/note-route.tsx`
- Modify: `src/components/library/transcript-route.tsx`
- Modify: `src/components/transcripts/transcript-viewer.tsx`

- [ ] **Step 1: Remove editor `window.prompt`**

In `document-editor.tsx`, replace `setLink()` prompt behavior with link dialog state:

```ts
const [linkDialogOpen, setLinkDialogOpen] = useState(false);
const [linkHref, setLinkHref] = useState("");
```

Toolbar Link button sets `linkHref` from `editor.getAttributes("link").href ?? "https://"` and opens the dialog.

The dialog submit:

```ts
if (linkHref.trim() === "") {
  editor.chain().focus().unsetLink().run();
} else {
  editor.chain().focus().setLink({ href: linkHref.trim() }).run();
}
setLinkDialogOpen(false);
```

- [ ] **Step 2: Make note route feel like a page**

In `note-route.tsx`, render:

- top-left `Back to library` link.
- document title/breadcrumb.
- loading/error/not-found states.
- full-width editor without the library list beside it.

- [ ] **Step 3: Make transcript route feel like a page**

In `transcript-route.tsx`, render:

- top-left `Back to library` link.
- recording/file title.
- loading/error/not-found states.
- `TranscriptViewer` with its existing close prop either omitted or mapped to route navigation.

- [ ] **Step 4: Verify and commit**

Run:

```bash
rg -n "window\\.prompt|window\\.confirm|prompt\\(|confirm\\(" src/components
bun run check
```

Expected: no native prompt/confirm usage remains in components; check is green.

Commit:

```bash
git add src/components/editor/document-editor.tsx src/components/library/note-route.tsx src/components/library/transcript-route.tsx src/components/transcripts/transcript-viewer.tsx
git commit -m "feat(editor): use route page and link dialog"
```

---

### Task 6: Density, Responsive Overflow, Disabled Scope, And Docs

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/library/library-sidebar.tsx`
- Modify: `src/components/library/library-actions.tsx`
- Modify: `docs/product-specs/library-and-notes.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/FRONTEND.md`

- [ ] **Step 1: Reduce dense UI type without shrinking note prose too much**

Change global body font from `14px` to `13px` or keep body at `14px` and lower controls:

- Button base: `text-sm` to `text-[13px]`.
- Input base: `text-base md:text-sm` to `text-[13px]`.
- Sidebar/nav rows: `text-sm` to `text-[13px]`.
- Keep `.lumen-editor` at its current readable size unless manual verification shows it is oversized.

- [ ] **Step 2: Prevent top-bar overflow**

For action buttons in `library-actions.tsx` and top bars:

```tsx
<span className="hidden sm:inline">Upload</span>
```

Keep icons always visible. Add `title` and `sr-only` labels for icon-only breakpoints.

- [ ] **Step 3: Make Recents intentionally disabled**

In `library-sidebar.tsx`, ensure Recents has:

```tsx
aria-disabled="true"
title="Recents ship in a later release"
className="... cursor-not-allowed opacity-50"
```

Do not attach an `onClick` handler.

- [ ] **Step 4: Document route and release boundaries**

Update docs:

- `docs/product-specs/library-and-notes.md`: note `/library`, `/library/notes/[id]`, `/library/transcripts/[recordingId]`, `/library/tags`, disabled Recents.
- `docs/DESIGN.md`: update routing section to match implemented routes.
- `docs/FRONTEND.md`: add responsive icon-only behavior for narrow action bars.

Add Supabase OTP note to `docs/SECURITY.md` or `docs/product-specs/library-and-notes.md`:

```md
Production email confirmation requires Supabase Auth email confirmations,
SMTP configured in the Supabase dashboard, and a confirmation template that
includes `{{ .Token }}` so users can enter the one-time code in Lumen.
Local testing uses Inbucket from `bunx supabase start`.
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
bun run check
```

Expected: green.

Commit:

```bash
git add src/app/globals.css src/components/ui/button.tsx src/components/ui/input.tsx src/components/library/library-sidebar.tsx src/components/library/library-actions.tsx docs/product-specs/library-and-notes.md docs/DESIGN.md docs/FRONTEND.md docs/SECURITY.md
git commit -m "docs(ui): record pre-v2 route and auth cleanup"
```

---

### Task 7: E2E And Manual Browser Verification

**Files:**
- Modify: `e2e/library-happy-path.spec.ts`

- [ ] **Step 1: Complete library happy path E2E**

Update `e2e/library-happy-path.spec.ts` to cover:

```ts
await expect(page).toHaveURL(/\/library$/);
await page.getByRole("button", { name: "New folder" }).click();
await page.getByLabel("Folder name").fill("Testing");
await page.getByRole("button", { name: "Create folder" }).click();
await expect(page.getByRole("button", { name: "Testing" })).toBeVisible();

await page.getByRole("button", { name: "New note" }).click();
await page.getByLabel("Note title").fill("Route note");
await page.getByRole("button", { name: "Create note" }).click();
await page.getByRole("button", { name: "Route note" }).click();
await expect(page).toHaveURL(/\/library\/notes\/[0-9a-f-]+$/i);

await page.getByRole("link", { name: "Back to library" }).click();
await expect(page).toHaveURL(/\/library$/);
```

Keep the existing search assertion, but update it to expect route-backed note opening.

- [ ] **Step 2: Add upload picker E2E coverage**

Use Playwright `setInputFiles` on the hidden file input if available:

```ts
await page.getByRole("button", { name: "Upload" }).click();
await page.getByLabel("Choose file").setInputFiles({
  name: "notes.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("hello"),
});
await expect(page.getByText("notes.txt")).toBeVisible();
await page.getByRole("button", { name: "Remove selected file" }).click();
await expect(page.getByText("notes.txt")).not.toBeVisible();
```

- [ ] **Step 3: Add tag preset E2E coverage**

Create a tag through the UI, choose a preset color by label, and assert the tag filter appears. Avoid asserting exact CSS color in E2E; component tests cover the submitted value.

- [ ] **Step 4: Run gates**

Run:

```bash
bun run check
bun run test:e2e
```

Expected: both green with local Supabase running.

- [ ] **Step 5: Manual browser pass**

Start:

```bash
bunx supabase start
bun run dev
```

Verify in browser:

- Login redirects to `/library`.
- Sign-up sends a six-digit code; Inbucket code verifies and enters `/library`.
- New folder works.
- Top-bar Search, Upload, and New note work.
- Notes open on `/library/notes/[id]` and can return to `/library`.
- Transcript opens on `/library/transcripts/[recordingId]` and can return to `/library`.
- Tags work with preset colors.
- Recents is disabled and clearly later-scoped.
- At a narrow viewport, top-bar actions show icons without overflowing.

- [ ] **Step 6: Final commit**

Commit any remaining E2E/test/docs changes:

```bash
git add e2e docs src
git commit -m "test(e2e): cover pre-v2 cleanup flows"
```

---

## Plan Self-Review

- **Spec coverage:** Routes ✅ Task 2; full-page notes/transcripts ✅ Tasks 2 and 5; component split ✅ Task 4; broken buttons ✅ Task 4; custom dialogs ✅ Tasks 3-5; tag color presets ✅ Tasks 3-4; upload clear button ✅ Task 3; confirm password and OTP ✅ Task 1; smaller responsive UI ✅ Task 6; Recents disabled and Ask Lumen v2-only ✅ Task 6; docs ✅ Task 6; E2E/manual verification ✅ Task 7.
- **Placeholder scan:** No task uses TBD/TODO/fill-in instructions. Steps name exact files, expected commands, and concrete behavior.
- **Type consistency:** Auth state uses `AuthState`; route pages use Next 16 `params: Promise<...>`; library components retain existing `Tables<...>` row types and `LibrarySnapshot`; tag colors remain strings stored in `tags.color`.
- **Risk notes:** Supabase OTP email requires the confirmation template to include `{{ .Token }}` locally and in the production dashboard. If Supabase recommends `type: "email"` for this installed auth version, use that type in `verifyOtp` and document the decision in the commit message.
