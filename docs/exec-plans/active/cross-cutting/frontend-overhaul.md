# Frontend Overhaul Implementation Plan (mobile-first + component quality)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Design spec:** [`docs/superpowers/specs/2026-06-10-frontend-overhaul-design.md`](../../../superpowers/specs/2026-06-10-frontend-overhaul-design.md)

**Version:** cross-cutting
**Branch:** `frontend-overhaul`

**Goal:** Make every `apps/web` surface mobile-first responsive and bring component quality (alignment, hover/focus states, touch targets, dialog ergonomics) up to the DESIGN.md handoff spec — zero new dependencies, zero visual-language changes.

**Architecture:** Foundation-first. New/upgraded primitives in `src/components/ui/` (Sheet, responsive Dialog, DropdownMenu, Select, Button hit areas, global type polish), then a per-surface sweep that consumes them: shell drawer → library rows/chips/breadcrumb → editor/transcript/live → auth/search/tags → mobile e2e + screenshot verification.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`sm` 640 / `md` 768 / `lg` 1024, `pointer-coarse:`/`max-sm:` variants), unified `radix-ui` package (already a dep), tw-animate-css (already imported), lucide-react, Playwright.

---

## Conventions (read once before starting)

- **No TDD for visual CSS.** This repo's component test harness doesn't cover layout/styling. The gate for every task is `bun run check` green from repo root, plus the e2e + browser verification tasks at the end. Where a task touches testable behavior (e2e flows), tests are included.
- **Mobile-first classes:** write base styles for ~375px, add `sm:`/`md:`/`lg:` enhancements. Never `max-lg:` for new code unless undoing a base style is strictly worse.
- **Token discipline:** colors/fonts/radii come from existing CSS custom properties (`--surface-2`, `--accent-soft`, `--border-soft`, …) via arbitrary values (`bg-[var(--surface-2)]`) or mapped utilities, exactly as the surrounding code does. No new hex values anywhere.
- **Hover states:** Tailwind v4 `hover:` only applies on hover-capable devices — rely on it; pair any `md:group-hover:opacity-100` reveal with `md:group-focus-within:opacity-100` and an always-visible touch fallback.
- **Animations:** tw-animate-css utilities (`animate-in`, `fade-in-0`, `slide-in-from-bottom-4`, `zoom-in-95`) on `data-[state=…]`, always with `motion-reduce:animate-none`.
- **`radix-ui` imports:** `import { Dialog as DialogPrimitive, DropdownMenu as DropdownMenuPrimitive } from "radix-ui"` — the unified package, same style as the existing `ui/dialog.tsx`.
- Run `bun install` once from repo root before starting (no new deps; ensures workspace ready).
- Supabase must be running for e2e: `cd apps/web && bunx supabase start`.

## File map

```
apps/web/src/
  app/globals.css                       MODIFY — font smoothing, tabular-nums, text-wrap, 16px mobile inputs
  components/ui/
    sheet.tsx                           NEW — left drawer primitive (radix Dialog based)
    dialog.tsx                          MODIFY — responsive bottom-sheet/centered + Header/Footer helpers
    dropdown-menu.tsx                   NEW — row action menus
    select.tsx                          NEW — styled native <select>
    button.tsx                          MODIFY — touch hit areas
    input.tsx                           MODIFY — mobile font size (via globals)
  components/library/
    library-shell.tsx                   MODIFY — drawer shell + hamburger top row
    library-workspace.tsx               MODIFY — top bar slot, breadcrumb, chip bar wiring
    library-sidebar.tsx                 MODIFY — unchanged content, minor: remove mobile border hack
    library-item-row.tsx                MODIFY — single tap target + ⋯ menu
    library-dialogs.tsx                 MODIFY — DialogHeader/Footer + new SelectDialog
    library-filter-chips.tsx            NEW — All + per-tag filter chips
    library-paths.ts                    MODIFY — add folderPath() ancestor helper
  components/editor/document-editor.tsx MODIFY — scrollable toolbar, touch targets
  components/transcripts/transcript-viewer.tsx MODIFY — stacked segments <sm, 44px controls
  components/library/live-session-route.tsx / note-route.tsx / transcript-route.tsx MODIFY — header/spacing conventions
  components/auth-form.tsx              MODIFY — minor (16px inputs come from globals)
  components/search/search-panel.tsx    MODIFY — full-width input, tap targets
  components/library/tag-panel.tsx      MODIFY — 44px targets, wrap
apps/web/src/app/(auth)/…               MODIFY only if padding fixes needed (check layout file)
apps/web/e2e/mobile-smoke.spec.ts       NEW — 375×812 drawer + row-menu flow
```

---

## Task 1: `Sheet` primitive

**Files:**
- Create: `apps/web/src/components/ui/sheet.tsx`

- [x] **Step 1: Create the file**

```tsx
"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

/**
 * Left-side drawer. Built on the dialog primitive so focus trapping, Esc, and
 * overlay dismissal come for free. Used for the mobile sidebar; render a
 * visually hidden <SheetTitle> inside for screen readers.
 */
export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[85vw] max-w-[320px] flex-col border-r border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-pop)] outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
```

- [x] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/sheet.tsx
git commit -m "feat(web): add Sheet drawer primitive"
```

---

## Task 2: Responsive `Dialog` (bottom sheet `<sm`) + `DialogHeader`/`DialogFooter`

**Files:**
- Modify: `apps/web/src/components/ui/dialog.tsx`
- Modify: `apps/web/src/components/library/library-dialogs.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx` (upload dialog footer)

- [x] **Step 1: Replace `ui/dialog.tsx` contents**

```tsx
"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Responsive dialog: bottom sheet below `sm` (full-width, rounded top,
 * safe-area bottom padding), centered modal at `sm+`. Animations respect
 * prefers-reduced-motion.
 */
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 w-full rounded-t-xl border-t border-[var(--border-soft)] bg-[var(--surface)] p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)] outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(calc(100vw-32px),420px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:border sm:pb-4",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

/** Stacked full-width actions on mobile, right-aligned row at sm+. */
export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-col-reverse gap-2 *:w-full sm:flex-row sm:justify-end sm:*:w-auto",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
```

- [x] **Step 2: Adopt `DialogFooter` in `library-dialogs.tsx`**

In `TextInputDialog`, replace the footer `div`:

```tsx
// before
<div className="flex justify-end gap-2">
// after
<DialogFooter>
```

(and the closing tag; remove `mt-3`/spacing conflicts — keep the form's `space-y-4`, drop the footer's old classes entirely). Same change in `ConfirmDialog`: replace `<div className="mt-4 flex justify-end gap-2">` with `<DialogFooter>`. Add `DialogFooter` to the import from `@/components/ui/dialog`.

- [x] **Step 3: Adopt `DialogFooter` in the upload dialog**

In `library-workspace.tsx`, the upload form's `<div className="flex justify-end gap-2">` becomes `<DialogFooter>` (import it).

- [x] **Step 4: Verify**

Run: `bun run check`
Expected: PASS.

Run: `cd apps/web && bun run dev`, open `http://localhost:3000/library`, narrow viewport to 375px (devtools), open "New note": dialog rises from the bottom, full width, buttons stacked (Create above Cancel reversed order — `flex-col-reverse` puts primary on top); at ≥640px it's the centered modal.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/dialog.tsx apps/web/src/components/library/library-dialogs.tsx apps/web/src/components/library/library-workspace.tsx
git commit -m "feat(web): responsive dialog - bottom sheet on mobile, shared footer"
```

---

## Task 3: `DropdownMenu` + `Select` primitives

**Files:**
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/select.tsx`

- [x] **Step 1: Create `dropdown-menu.tsx`**

```tsx
"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[180px] overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-pop)]",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-[4px] px-2 text-[13px] text-[var(--text-2)] outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-highlighted:bg-[var(--surface-3)] data-highlighted:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "destructive" &&
          "text-destructive data-highlighted:bg-[var(--danger-soft)] data-highlighted:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-[var(--border-soft)]", className)}
      {...props}
    />
  );
}
```

- [x] **Step 2: Create `select.tsx`** (styled native select — better mobile ergonomics than a custom listbox)

```tsx
import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className="h-9 w-full appearance-none rounded-md border border-input bg-[var(--surface-2)] pr-8 pl-3 text-[13px] text-foreground transition-[border-color,box-shadow,background] duration-150 ease-[var(--ease)] outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
```

- [x] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/dropdown-menu.tsx apps/web/src/components/ui/select.tsx
git commit -m "feat(web): add DropdownMenu and styled native Select primitives"
```

---

## Task 4: Button hit areas + global type polish

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/app/globals.css`

- [x] **Step 1: Button base classes**

In the `cva` base string in `button.tsx`, add (keep everything else byte-identical):

- `relative` and `touch-manipulation`
- `pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5 pointer-coarse:before:content-['']`

This expands the effective tap target ~12px on coarse pointers (28px `icon-sm` → 40px+, 24px `icon-xs`/`xs` → 36px+ — pair the smallest sizes with generous surrounding spacing) without changing visuals or layout.

- [x] **Step 2: globals.css base-layer additions**

Inside the existing `@layer base` block, add:

```css
  body {
    -webkit-font-smoothing: antialiased;
  }
  h1,
  h2,
  h3 {
    text-wrap: balance;
  }
  :where(.font-mono, code, kbd) {
    font-variant-numeric: tabular-nums;
  }
  /* Prevent iOS Safari focus zoom below the sm breakpoint. */
  @media (max-width: 39.99rem) {
    input,
    select,
    textarea {
      font-size: 16px;
    }
  }
```

(Merge the `-webkit-font-smoothing` line into the existing `body` rule rather than adding a second `body` block.)

- [x] **Step 3: Verify**

Run: `bun run check`
Expected: PASS. In the browser at 375px, focusing the search input no longer zooms the page (iOS sim / responsive mode), buttons unchanged visually.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/button.tsx apps/web/src/app/globals.css
git commit -m "feat(web): touch hit areas and global type polish"
```

---

## Task 5: Shell drawer + hamburger top row

**Files:**
- Modify: `apps/web/src/components/library/library-shell.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-sidebar.tsx`

- [x] **Step 1: Replace `library-shell.tsx` contents**

```tsx
"use client";

import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function LibraryShell({
  sidebar,
  topBar,
  children,
}: {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="grid h-dvh min-h-0 flex-1 grid-cols-1 overflow-hidden bg-background lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="hidden min-h-0 lg:flex lg:flex-col">{sidebar}</div>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          aria-describedby={undefined}
          // Any nav/folder/tag activation inside the drawer should also close
          // it; capturing link/button clicks is simpler than threading a
          // callback through every sidebar row.
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("a, button")) {
              setNavOpen(false);
            }
          }}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <section className="flex min-h-0 flex-col overflow-hidden">
        <div className="sticky top-0 z-20 flex min-h-[52px] items-center gap-1 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-ml-1.5 lg:hidden"
            title="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <span className="sr-only">Open navigation</span>
            <Menu className="size-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center">{topBar}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
```

- [x] **Step 2: Slim the workspace top bar**

In `library-workspace.tsx`, the `topBar` JSX no longer owns the sticky chrome (the shell does now). Replace its outer div classes:

```tsx
// before
<div className="sticky top-0 z-20 flex min-h-[52px] items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
// after
<div className="flex min-h-[52px] w-full min-w-0 items-center justify-between gap-3">
```

- [x] **Step 3: Sidebar border cleanup**

In `library-sidebar.tsx`, the `<aside>` no longer needs the stacked-layout border hack. Replace:

```tsx
// before
className="flex min-h-0 flex-col overflow-hidden border-b border-[var(--border-soft)] bg-[var(--surface)] lg:border-r lg:border-b-0"
// after
className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)] lg:border-r lg:border-[var(--border-soft)]"
```

- [x] **Step 4: Verify**

Run: `bun run check` → PASS.
Browser at 375px: sidebar gone from flow; hamburger opens drawer with the full sidebar; tapping a folder selects it AND closes the drawer; Esc/overlay close; at ≥1024px the 280px column is back and the hamburger is hidden. The note/transcript full-page routes are unaffected (they don't use `LibraryShell`).

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/library/library-shell.tsx apps/web/src/components/library/library-workspace.tsx apps/web/src/components/library/library-sidebar.tsx
git commit -m "feat(web): mobile drawer navigation for the library shell"
```

---

## Task 6: Item row redesign — single tap target + `⋯` menu

**Files:**
- Modify: `apps/web/src/components/library/library-item-row.tsx`
- Modify: `apps/web/src/components/library/library-dialogs.tsx` (add `SelectDialog`)

- [x] **Step 1: Add `SelectDialog` to `library-dialogs.tsx`**

```tsx
export function SelectDialog({
  open,
  onOpenChange,
  title,
  label,
  options,
  defaultValue = "",
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}) {
  const fieldId = useId();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        <form
          className="mt-3 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(value);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>{label}</Label>
            <Select
              id={fieldId}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Add `import { Select } from "@/components/ui/select";` at the top.

- [x] **Step 2: Rewrite `ItemRow`**

Keep: all mutations/hooks, `STATUS_TONE`, `TagChips`, icon/name/meta derivation, `TextInputDialog`/`ConfirmDialog` wiring. Remove: `TagAttachForm`, `MoveSelect` (inline selects die). New row body:

```tsx
const [moveOpen, setMoveOpen] = useState(false);
const [tagOpen, setTagOpen] = useState(false);
const attachTag = useLibraryMutation(linkTag);

const availableTags = snapshot.tags.filter(
  (tag) =>
    !snapshot.tagLinks.some(
      (tagLink) =>
        tagLink.target_type === targetType &&
        tagLink.target_id === item.id &&
        tagLink.tag_id === tag.id,
    ),
);

function openItem() {
  if (type === "folder") onOpenFolder?.(item.id);
  if (type === "document") onOpenDocument?.(item.id);
  if (recording) onOpenRecording?.(recording.id);
}

return (
  <li className="group flex items-start gap-2 border-b border-[var(--border-soft)] py-2.5 last:border-b-0">
    <button
      type="button"
      onClick={openItem}
      className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left"
    >
      {/* existing 34px icon tile div, unchanged */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{name}</p>
        <p className="truncate font-mono text-[11.5px] text-[var(--text-3)]">{meta}</p>
        {type !== "folder" && (
          <TagChips snapshot={snapshot} targetType={targetType} targetId={item.id} />
        )}
      </div>
    </button>
    <div className="flex shrink-0 items-center gap-2 pt-2">
      {recording && (
        <span className={`l-badge hidden sm:inline-flex ${STATUS_TONE[recording.status]}`}>
          {recording.status}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:aria-expanded:opacity-100"
            title={`Actions for ${name}`}
          >
            <span className="sr-only">Actions for {name}</span>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {type === "document" && (
            <DropdownMenuItem onSelect={() => onOpenDocument?.(item.id)}>
              <FileText /> Open
            </DropdownMenuItem>
          )}
          {recording && (
            <DropdownMenuItem onSelect={() => onOpenRecording?.(recording.id)}>
              <Mic /> Transcript
            </DropdownMenuItem>
          )}
          {type !== "folder" && availableTags.length > 0 && (
            <DropdownMenuItem onSelect={() => setTagOpen(true)}>
              <Tag /> Add tag…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
            <FolderInput /> Move…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil /> Rename…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {/* TextInputDialog + ConfirmDialog unchanged, plus: */}
    <SelectDialog
      open={tagOpen}
      onOpenChange={setTagOpen}
      title={`Tag ${name}`}
      label="Tag"
      options={availableTags.map((tag) => ({ value: tag.id, label: tag.name }))}
      defaultValue={availableTags[0]?.id ?? ""}
      submitLabel="Add tag"
      onSubmit={(tagId) => attachTag.mutate({ tagId, targetType, targetId: item.id })}
    />
    <SelectDialog
      open={moveOpen}
      onOpenChange={setMoveOpen}
      title={`Move ${name}`}
      label="Destination"
      options={[
        { value: "", label: "Library" },
        ...snapshot.folders
          .filter((folder) => folder.id !== item.id)
          .map((folder) => ({ value: folder.id, label: folder.name })),
      ]}
      defaultValue={("folder_id" in item ? item.folder_id : item.parent_id) ?? ""}
      submitLabel="Move"
      onSubmit={(folderId) => {
        const dest = folderId === "" ? null : folderId;
        if (type === "folder") moveFolderMutation.mutate({ id: item.id, parentId: dest });
        if (type === "document") moveDocumentMutation.mutate({ id: item.id, folderId: dest });
        if (type === "file") moveFileMutation.mutate({ id: item.id, folderId: dest });
      }}
    />
  </li>
);
```

Notes: status badge shows inline on `sm+`; below `sm` the recording status is already conveyed by the busy-tinted mic tile (avoids row wrap at 375px). Mobile keeps `⋯` always visible (base opacity untouched; only `md:` hides it until hover/focus). Tag-removal stays on the chips (`TagChips` is unchanged but now nested in the row button — change its chip `<button>` to stop propagation: add `onClick={(event) => { event.stopPropagation(); link && unlink.mutate(link.id); }}`). Lucide imports: add `FolderInput`, `MoreHorizontal`; drop unused.

**Nested-button caveat:** `TagChips` buttons inside the row `<button>` are invalid HTML. Restructure: the row container `<li>` gets `relative`; the open-item `<button>` covers name/meta only, and `TagChips` renders as a sibling under it inside the same flex column (outside the button element). Final structure:

```tsx
<div className="min-w-0 flex-1">
  <button type="button" onClick={openItem} className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-md py-1 text-left">
    {iconTile}
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium text-foreground">{name}</p>
      <p className="truncate font-mono text-[11.5px] text-[var(--text-3)]">{meta}</p>
    </div>
  </button>
  {type !== "folder" && (
    <div className="pl-[46px]">
      <TagChips snapshot={snapshot} targetType={targetType} targetId={item.id} />
    </div>
  )}
</div>
```

- [x] **Step 3: Verify**

Run: `bun run check` → PASS.
Browser: desktop row shows `⋯` on hover/focus; menu opens with all actions; Add tag/Move open dialogs (bottom sheets at 375px); rename/delete still work; tag chip click removes tag without opening the item; no nested-button hydration warning in console.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/library/library-item-row.tsx apps/web/src/components/library/library-dialogs.tsx
git commit -m "feat(web): collapse item row actions into a dropdown menu"
```

---

## Task 7: Filter chip bar + clickable breadcrumb

**Files:**
- Create: `apps/web/src/components/library/library-filter-chips.tsx`
- Modify: `apps/web/src/components/library/library-paths.ts`
- Modify: `apps/web/src/components/library/library-workspace.tsx`

- [x] **Step 1: Create `library-filter-chips.tsx`**

```tsx
"use client";

import type { Tables } from "@/server/db/database.types";

type TagRow = Tables<"tags">;

export function LibraryFilterChips({
  tags,
  selectedTagId,
  onSelectTag,
}: {
  tags: TagRow[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
}) {
  if (tags.length === 0) return null;

  const base =
    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-[background,border-color,color] duration-150 ease-[var(--ease)]";

  return (
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      <span className="mr-1 shrink-0 font-mono text-[11.5px] text-[var(--text-3)] uppercase">
        Filter
      </span>
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        aria-pressed={selectedTagId === null}
        className={`${base} ${
          selectedTagId === null
            ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
            : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
        }`}
      >
        All
      </button>
      {tags.map((tag) => {
        const selected = selectedTagId === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(selected ? null : tag.id)}
            aria-pressed={selected}
            className={`${base} ${
              selected
                ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-foreground"
                : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
            }`}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: tag.color ?? "#64748b" }}
            />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [x] **Step 2: Add `folderPath` to `library-paths.ts`**

Read the file first; add alongside `folderName`, following its snapshot-shape conventions:

```ts
/** Ancestor chain root→folder for breadcrumbs; empty array at the library root. */
export function folderPath(
  snapshot: Pick<LibrarySnapshot, "folders">,
  folderId: string | null,
): { id: string; name: string }[] {
  const byId = new Map(snapshot.folders.map((folder) => [folder.id, folder]));
  const path: { id: string; name: string }[] = [];
  let current = folderId ? byId.get(folderId) : undefined;
  while (current) {
    path.unshift({ id: current.id, name: current.name });
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}
```

(Match the existing import/type style in that file — if `folderName` takes the whole snapshot, take the whole snapshot.)

- [x] **Step 3: Wire both into `library-workspace.tsx`**

Breadcrumb (replaces the current two-crumb version inside `topBar`):

```tsx
const crumbs = folderPath(snapshot, selectedFolderId);
// inside topBar's left div:
<button type="button" className="shrink-0 truncate hover:text-foreground" onClick={() => setSelectedFolderId(null)}>
  Library
</button>
{crumbs.map((crumb, index) => {
  const isLast = index === crumbs.length - 1;
  const isParent = index === crumbs.length - 2;
  return (
    <span key={crumb.id} className={`${isLast || isParent ? "flex" : "hidden sm:flex"} min-w-0 items-center gap-2`}>
      <ChevronRight className="size-4 shrink-0" />
      {!isLast && !isParent ? null : null}
      <button
        type="button"
        onClick={() => setSelectedFolderId(crumb.id)}
        className={`truncate ${isLast ? "text-foreground" : "hover:text-foreground"}`}
        aria-current={isLast ? "page" : undefined}
      >
        {crumb.name}
      </button>
    </span>
  );
})}
{crumbs.length > 2 ? (
  <span className="flex items-center sm:hidden" aria-hidden="true">…</span>
) : null}
```

Place the mobile ellipsis between "Library" and the first rendered crumb (i.e. render it right after the Library button when `crumbs.length > 2`), not at the end. Hidden crumbs stay reachable via the drawer's folder tree.

Chip bar: render `<LibraryFilterChips tags={snapshot.tags} selectedTagId={selectedTagId} onSelectTag={setSelectedTagId} />` directly under the `<h2>` header block (inside the `mb-5` div, after the item-count line, with `mt-3`).

- [x] **Step 4: Verify**

Run: `bun run check` → PASS.
Browser: nested folder shows full clickable chain at ≥640px, `Library › … › parent › current` at 375px; chips scroll horizontally on mobile without showing a scrollbar; selecting a chip filters and tints; "All" resets.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/library/library-filter-chips.tsx apps/web/src/components/library/library-paths.ts apps/web/src/components/library/library-workspace.tsx
git commit -m "feat(web): tag filter chip bar and clickable breadcrumb ancestors"
```

---

## Task 8: Editor, transcript viewer, live session — mobile pass

**Files:**
- Modify: `apps/web/src/components/editor/document-editor.tsx`
- Modify: `apps/web/src/components/transcripts/transcript-viewer.tsx`
- Modify: `apps/web/src/components/library/live-session-route.tsx`

Read each file before editing; apply these bounded changes and nothing else.

- [x] **Step 1: Editor toolbar**

- Toolbar container: `sticky top-0 z-10` within the editor scroll area; below `sm` make it a no-wrap horizontal scroller: `flex items-center gap-1 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden` with `-mx-4 px-4` gutter bleed; `sm:overflow-visible sm:flex-wrap sm:mx-0 sm:px-0`.
- Toolbar buttons: ensure every control is the shared `Button` (`variant="ghost" size="icon-sm"`) with `title` + `sr-only` labels — touch hit-area expansion from Task 4 then applies. Keep the exact existing toolset (repo rule; do not add controls).
- Autosave indicator: keep the colored dot at all widths; hide its text label below `sm` (`hidden sm:inline`), add `sr-only` status text.

- [x] **Step 2: Transcript viewer**

- Segment rows: current grid `[56px_1fr]` (or similar) becomes `grid-cols-1 gap-0.5 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-0` — timestamp renders above text below `sm`. Whole segment row remains the click-to-seek target with `min-h-[44px]` and `w-full text-left`.
- Player: Play/Pause ≥44px (`size-11`); rate toggle and any icon buttons get `title` + Task-4 hit areas; player block `sticky top-0 z-10` under the route header; waveform untouched.
- Timestamps/meta: confirm they render in `font-mono` (tabular-nums now applies globally).

- [x] **Step 3: Live session route**

- Same conventions: controls use shared `Button` sizes ≥44px effective, header truncates the title (`min-w-0 truncate`), no fixed pixel widths >viewport, mono meta in `font-mono`.

- [x] **Step 4: Verify**

Run: `bun run check` → PASS.
Browser at 375px: editor toolbar scrolls horizontally (no wrap, no page overflow), typing + autosave still work; transcript segments stack timestamp-over-text, tapping a segment seeks audio; at ≥640px both return to current desktop layouts. `bun run test:e2e` still green (run with Supabase up).

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/document-editor.tsx apps/web/src/components/transcripts/transcript-viewer.tsx apps/web/src/components/library/live-session-route.tsx
git commit -m "feat(web): mobile-first editor toolbar, transcript segments, live session"
```

---

## Task 9: Auth, search, tags — mobile pass

**Files:**
- Modify: `apps/web/src/components/auth-form.tsx` (verify only — likely no change)
- Modify: `apps/web/src/app/(auth)/` layout/pages (padding only, read first)
- Modify: `apps/web/src/components/search/search-panel.tsx`
- Modify: `apps/web/src/components/library/tag-panel.tsx`

Read each file before editing; bounded changes only.

- [x] **Step 1: Auth**

- Auth route layout: page container gets `px-4 py-8` minimum padding so the 360px card never touches edges at 320–375px. If a brand/split panel exists in the `(auth)` layout, it hides below `lg` (`hidden lg:flex`); single centered column below.
- `auth-form.tsx` itself keeps `max-w-[360px]` — inputs inherit 16px mobile size from Task 4 globals. Expected: no component change needed; verify, don't churn.

- [x] **Step 2: Search panel**

- Search input container: full width on mobile (`w-full`), no fixed pixel width.
- Result rows: full-width `<button>` targets with `min-h-[44px] w-full text-left`, truncation on name/crumb, serif snippet wraps (no `truncate` on the snippet).

- [x] **Step 3: Tag panel (sidebar) + `/library/tags` view**

- Tag rows: `min-h-[40px]` targets; color picker swatches ≥40px tap targets with `aria-pressed` selection state; row text truncates; controls wrap (`flex-wrap`) instead of overflowing at 280px sidebar/drawer width.

- [x] **Step 4: Verify**

Run: `bun run check` → PASS. `bun run test` (Vitest — `auth-form.test.tsx`, `tag-color-picker.test.tsx` must stay green; update queries only if markup around them changed).
Browser at 375px: login/signup cards padded and centered; search results tappable; tags view usable inside the drawer.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/auth-form.tsx apps/web/src/app/\(auth\) apps/web/src/components/search/search-panel.tsx apps/web/src/components/library/tag-panel.tsx
git commit -m "feat(web): mobile pass for auth, search, and tags surfaces"
```

---

## Task 10: Mobile e2e smoke + full verification pass

**Files:**
- Create: `apps/web/e2e/mobile-smoke.spec.ts`
- Modify: `docs/FRONTEND.md` (document the new responsive conventions in the same change — repo doc rule)

- [x] **Step 1: Write the mobile smoke test**

```ts
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/library$/);
}

test("mobile drawer + row actions happy path", async ({ page }) => {
  await login(page);

  // No horizontal overflow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  // Drawer: open, create a note from the sidebar action, drawer closes.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "New note" }).click();
  await page.getByLabel("Note title").fill("Mobile note");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page.getByRole("button", { name: "Mobile note" }).first()).toBeVisible();

  // Row ⋯ menu: rename through the bottom-sheet dialog.
  await page.getByRole("button", { name: "Actions for Mobile note" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByLabel("Name").fill("Mobile note 2");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("button", { name: "Mobile note 2" }).first()).toBeVisible();

  // Cleanup: delete it.
  await page.getByRole("button", { name: "Actions for Mobile note 2" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Mobile note 2" })).toHaveCount(0);
});
```

- [x] **Step 2: Run the e2e suite**

Run: `cd apps/web && bunx supabase start && bun run test:e2e`
Expected: existing specs + mobile smoke PASS. Adjust selectors only if a real regression in this plan's changes is found — fix the code, not the assertion.

- [x] **Step 3: Screenshot verification grid**

With dev server running, capture (Chrome DevTools MCP or manual) at **375 / 768 / 1280** widths: auth login, `/library` (drawer open + closed at 375), note editor, transcript viewer (done + processing if seed data allows), `/library/tags`, search results. Check each: no horizontal scroll (also spot-check 320px), aligned buttons, visible focus rings (tab through one screen per surface), reduced-motion emulation kills dialog/drawer animations.

- [x] **Step 4: Update `docs/FRONTEND.md`**

Add a "Responsive conventions" subsection: mobile-first base + `sm/md/lg` ramp, drawer shell pattern, responsive dialog (bottom sheet `<sm`), `DialogFooter` for all dialog actions, dropdown row-action menus, touch hit-area rule, 16px mobile inputs. Remove the stale "Not yet implemented" note about the dark restyle if it misstates current reality after this work.

- [x] **Step 5: Final gate + commit**

```bash
bun run check          # green
git add apps/web/e2e/mobile-smoke.spec.ts docs/FRONTEND.md
git commit -m "test(web): mobile smoke e2e + responsive conventions docs"
```

Then: repo working rule 3 (manual happy path in a real browser) and rule 7 (docs-sanity-check → finishing-a-development-branch) before closing the branch.

---

## Self-review notes (author)

- **Spec coverage:** breakpoints/shell §1 → T5; primitives §2 → T1–T4; library §3 → T6–T7; editor/transcript/live §4 → T8; auth §5 / search+tags §6 → T9; verification §7 + testing → T10. Empty state restyle (§3 last bullet) is intentionally folded into T7's workspace edits if the current empty state misaligns — current implementation already matches the handoff per code read; no separate task.
- **Placeholder scan:** T8/T9 are directive (files not fully read at planning time) but bounded: exact files, exact class recipes, exact verification. No TBDs.
- **Type consistency:** `SelectDialog` props match both call sites in T6; `folderPath` return shape matches T7 breadcrumb usage; `Sheet`/`DialogFooter` APIs match their consumers in T5/T2/T6.
- **Known risks:** nested-interactive cleanup in T6 (explicit restructure given); radix `DropdownMenuItem` `onSelect` closing before dialog opens — if the dialog fails to open, add `event.preventDefault()` in `onSelect` and open via `setTimeout(0)`; tw-animate class names verified against the package's documented utilities.

---

## Execution log (2026-06-10)

All 10 tasks executed inline; `bun run check` green per commit; e2e suite
green (mobile smoke included; live-session spec remains env-gated/skipped).

**Deviations from plan:**

- **Assistant panel (unplanned fix, root cause of "unusable on mobile"):**
  `(app)/layout.tsx` rendered `AssistantPanel` as an always-on 320px flex
  child, leaving a 375px phone with 55px of app. Panel is now `hidden lg:flex`
  and the content column gained `min-w-0`. A responsive assistant entry point
  is future work (tracked in FRONTEND.md).
- **Menu→dialog race:** the plan's flagged risk materialized; fixed with the
  planned mitigation (defer dialog open one tick — `openAfterMenuCloses` in
  `library-item-row.tsx`).
- **`library-happy-path` tag assertion** scoped to the sidebar
  (`getByRole("complementary")`) because the new filter chip bar legitimately
  duplicates the tag button in the content area.
- **TagColorPicker** swapped its raw `<select>` for the shared `Select`
  (consistency; covered by existing Vitest suite).

**Verification evidence:** Chrome DevTools screenshots at 375/768/1280 —
auth, library (drawer open/closed, bottom-sheet dialog), editor; 320px
overflow = 0; focus rings visible; row `⋯` menu Open/Add tag/Move/Rename/
Delete verified including DB persistence. Transcript-with-segments view not
re-screenshotted (fresh seed has no recordings; change was CSS-only segment
stacking) — covered by the manual happy path at branch close.

## Code-review fixes (2026-06-10, post-execution review)

Subagent code review (range c685c1a..d34e5b4) found one Critical and two
Important issues; all fixed and covered:

1. **Critical — drawer close-on-click unmounted drawer-owned dialogs.** Tag
   rename/delete dialogs live inside `TagPanel` (drawer content on mobile);
   React portals propagate synthetic events through the React tree, so the
   close-any-button capture handler closed the drawer and unmounted the
   just-opened dialog. Fix: the handler now skips clicks inside any
   `role="dialog"` other than the drawer itself, plus a `data-drawer-stay`
   opt-out (tag rename/delete buttons, tag create form). New e2e: drawer tag
   create → rename → delete.
2. **Important — 16px mobile input rule was inert.** Tailwind v4 utilities
   layer beats `@layer base`, so component `text-[13px]` won. Fixed in the
   components: `Input`/`Select` are `text-[16px] sm:text-[13px]`, search input
   `text-[16px] sm:text-[15px]`; globals rule kept for raw elements. New e2e
   assertion checks computed font-size ≥16px at 375px.
3. **Important — chips/breadcrumbs below touch floor.** Filter chips (28px)
   and breadcrumb buttons now carry the `pointer-coarse` hit-area expansion
   (chips ≥40px, crumbs ≥40px effective).

Minors taken: `folderPath()` cycle guard; selected tag chips use
`--accent-text` (consistent with "All"). Minors deferred: double-mounted
sidebar below `lg` (state divergence is cosmetic); Move dialog offering
descendants (server rejects; pre-existing); menu-open via controlled state
instead of `setTimeout(0)`.

Verification after fixes: `bun run check` green, full e2e green (5 passed,
live-session spec env-gated).
