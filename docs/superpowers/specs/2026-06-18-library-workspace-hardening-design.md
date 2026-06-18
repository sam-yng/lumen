# Library workspace hardening - design spec

> **Status:** approved design input for
> [`exec-plans/active/cross-cutting/library-node-recovery.md`](../../exec-plans/active/cross-cutting/library-node-recovery.md).
> Date: 2026-06-18.

## Problem

The library recovery restored the missing product surfaces, but it concentrated
route dispatch, mutation orchestration, local UI state, dialogs, and rendering
inside `LibraryWorkspace`. React Doctor now reports the resulting component
size, related `useState` calls, render-driven navigation effects, and an
imperative upload form handler.

The Supabase-backed Playwright smoke also fails intermittently in CI. The
captured trace proves workspace/note creation and the follow-up library refetch
complete successfully. The failure occurs after `router.push`, while the Next
development server is cold-compiling the destination's RSC payload for longer
than Playwright's five-second expectation timeout.

## Binding Decisions

1. Resolve direct visits to canonical leaf-note and audio-node URLs in the
   server route. Server Components use Next 16 `redirect()` before rendering;
   `LibraryWorkspace` must not redirect from effects.
2. Keep event-driven client navigation in event and mutation callbacks. Next 16
   explicitly supports `useRouter` for Client Component event handlers.
3. Replace the cluster of dialog booleans and selected-tag state with a focused
   reducer whose actions express dialog and tag transitions.
4. Split route-independent rendering and dialogs into focused library modules;
   `LibraryWorkspace` remains the query/mutation composition root.
5. Use a React form action for upload submission. Do not suppress native form
   submission with `preventDefault()`.
6. Keep Playwright assertions condition-based. Increase the CI expectation
   budget for cold Next development compilation; do not add sleeps.
7. Audit tests against current production modules and product behavior. Remove
   only tests that are obsolete, duplicated without distinct risk coverage, or
   exercise code that has no production consumer. Record retained tests and the
   reason they remain.
8. Do not rewrite the REST mutation layer into Server Actions in this pass.

## Architecture

The dynamic node page loads the authenticated library snapshot through the
existing service seam. A pure route-resolution helper classifies the requested
workspace/node pair as a container render, note redirect, transcript redirect,
or unresolved route. The page performs redirects; the helper remains directly
unit-testable.

Client workspace state moves to a reducer-backed hook. Presentational top-bar,
body, and dialog components receive derived data and callbacks. Query and
mutation ownership stays in `LibraryWorkspace`, avoiding a broad data-flow
rewrite while reducing the component's reading surface.

## Error Handling

An unknown workspace/node slug continues to render the library shell's existing
empty/unresolved state. An audio node without a recording remains in the shell
instead of redirecting to a nonexistent transcript. Service failures continue
through the existing library error UI.

Upload actions reject a missing/empty `File` before invoking the mutation.
Mutation behavior and existing error propagation remain unchanged.

## Testing

- Route tests prove server-side note and transcript redirects and container
  rendering before production route code changes.
- Reducer tests prove dialog exclusivity, tag toggling, and tag clearing before
  replacing local state.
- Workspace tests retain user-observable creation, upload, and navigation
  assertions across the component split.
- Playwright keeps URL/visible-state assertions but uses a CI-aware expectation
  budget that covers cold compilation.
- React Doctor, `bun run check`, the full Playwright smoke, and a manual browser
  happy path are required before commit/push.
- The test audit reports removals and retained high-value coverage separately;
  passing tests alone are not evidence that a test still matters.
