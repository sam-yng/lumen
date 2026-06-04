# Pre-v2 Cleanup Design

## Purpose

Before starting v2, Lumen needs a focused v1 cleanup pass that fixes testing
bugs, removes confusing dead controls, improves small-screen usability, and
creates clearer route/component boundaries for the next milestone. This is not
the v2 assistant/MCP build.

## Scope

This cleanup includes:

- Clear app routes: `/library` as the primary workspace route, with `/`
  redirecting to `/library`.
- Full-page note editing through `/library/notes/[id]`, replacing the current
  split-pane document state.
- Dedicated transcript viewing through `/library/transcripts/[recordingId]`.
- Smaller, more focused library components split out of
  `src/components/library/library-workspace.tsx`.
- Working top-bar and sidebar actions for search, upload, new note, and new
  folder.
- Custom dialogs for create, rename, delete, editor-link, and confirmation
  flows currently using `window.prompt` or native browser confirm.
- Tag creation with a preset color picker instead of raw hex entry.
- File upload selection that displays the selected file and supports clearing it
  with an icon button.
- Confirm-password validation on sign-up.
- Email one-time-code confirmation before a new account can access protected
  app routes.
- Smaller global/component text sizing where it improves density, while keeping
  note body text readable.
- Responsive action buttons that hide text before it can overflow and keep
  icons/tooltips available.

This cleanup excludes:

- Recents implementation. The Recents nav item should be disabled or clearly
  marked unavailable for now.
- Ask Lumen, MCP server, AI assistant UI, embeddings, semantic search, or
  citation features. Ask Lumen remains v2-only.
- Command palette implementation unless a later milestone explicitly scopes it.
- Rich file preview work beyond current upload/list behavior.

## Route Design

The protected `(app)` layout remains the server-side auth gate. It should keep
verifying the current Supabase user before rendering protected app pages.

Routes:

- `/` redirects to `/library`.
- `/library` renders the main library workspace.
- `/library/notes/[id]` renders the note editor as a full-page experience.
- `/library/transcripts/[recordingId]` renders the transcript viewer as a
  full-page experience.
- `/library/tags` renders tag management and tag-filtered library affordances.

Route groups should continue to organize protected and auth pages without
changing public URLs. This follows the Next 16 App Router docs: nested folders
define URL segments, and route groups in parentheses are omitted from the URL.

Opening a note or transcript should navigate to the matching route. Closing is
ordinary navigation back to `/library`, not local split-pane state. This resolves
the current "cannot close once opened" behavior by removing the trapped open
state from the main workspace.

## Library Component Design

`library-workspace.tsx` should be split along responsibilities as part of the
behavior work:

- `library-shell.tsx`: shared workspace chrome, loading/error state, and route
  slots.
- `library-sidebar.tsx`: smaller navigation, folder tree, disabled Recents,
  Tags link, Ask Lumen v2 affordance, and sign-out footer.
- `library-actions.tsx`: new note, new folder, upload, and record entry points.
- `library-content.tsx`: folder/document/file lists and empty states.
- `library-item-row.tsx`: open, move, rename, delete, and tag attach controls.
- `tag-panel.tsx`: tag list, tag create form, rename/delete actions, and filter
  controls.
- `tag-color-picker.tsx`: five preset colors with visible swatches and labels.
- `library-dialogs.tsx`: reusable app-specific dialog flows for text input,
  destructive confirmation, and simple action modals.
- `file-upload-picker.tsx`: file input facade that shows the selected file name
  and a trash icon button to clear selection.

`library-api.ts` remains the client API seam. Service-layer and API-route
boundaries should stay intact so v2 can continue exposing the same authenticated
domain operations later.

## UI Behavior

The top bar buttons become real controls:

- Search focuses or opens the existing search panel.
- Upload opens the upload dialog.
- New note opens a custom create-note dialog.

The sidebar actions become real controls:

- New folder opens a custom create-folder dialog scoped to the current folder.
- Recents is disabled or visibly marked later.
- Tags navigates to the tags view or focuses the tag management panel.
- Ask Lumen remains marked v2 and does not open a nonfunctional surface.

Native prompts are removed:

- Rename folder/document/file/tag uses an app dialog.
- Delete folder/document/file/tag uses an app confirmation dialog.
- Quick new note uses an app dialog.
- Editor link insertion uses a small link dialog from the editor toolbar.

Tag colors use a preset picker. The initial preset set should cover green,
blue, amber, red, and violet/default accent. Tags still store the selected color
as the existing `tags.color` text field.

Upload selection should not leave the browser-default "choose file" experience
as the only state. After a file is selected, the UI shows the file name, upload
metadata where useful, and a trash icon button that clears the selection.

Typography should become slightly denser across the app through global/base
component sizing and targeted sidebar/list reductions. The editor reading
surface should remain comfortably readable rather than shrinking as aggressively
as dense navigation and controls.

At narrow breakpoints, buttons with potential text overflow should keep icons
visible and hide nonessential labels. Tooltips and screen-reader labels should
preserve meaning.

## Auth Confirmation

Sign-up requires a confirm-password field. The server action validates password
match before calling Supabase.

New accounts must confirm email before accessing the protected app. The intended
flow is Supabase email OTP:

1. User submits email, password, and matching confirm password.
2. Supabase sends an email code.
3. User lands on a confirmation screen and enters the code.
4. A server action verifies the OTP with Supabase.
5. On success, the user is redirected to `/library`.

Protected routes continue to reject users without a valid authenticated Supabase
session. Existing confirmed users should log in normally.

The implementation must document production Supabase setup clearly: email
confirmation and SMTP must be configured in the Supabase dashboard for deployed
environments. Local development should document testing through Inbucket from
the Supabase local stack.

## Testing And Verification

Automated coverage should focus on user-visible behavior:

- Auth validation: sign-up rejects mismatched passwords and supports the OTP
  confirmation state.
- Tag color picker: selecting a preset submits that preset color.
- File upload picker: selecting a file shows its name; clearing removes it from
  the pending form state.
- Dialog flows: key create/rename/delete actions no longer call
  `window.prompt`.
- Routing: opening a note navigates to `/library/notes/[id]`; returning to the
  library clears the editor view.

End-to-end coverage should update the current happy path:

- Log in and land on `/library`.
- Create a folder.
- Create a note.
- Open the note full-page route.
- Navigate back to `/library`.
- Select and clear an upload file.
- Use tag filtering.

Manual verification should include:

- `bun run check`.
- A browser happy path against the local app.
- A mobile-width pass for sidebar/top-bar overflow and icon-only controls.
- Local Supabase email confirmation testing with Inbucket.

## Documentation Updates

The cleanup plan and docs should record:

- `/library` is the primary app route.
- Notes and transcripts are route-backed page views.
- Recents is intentionally disabled until a later release.
- Ask Lumen is v2-only.
- Supabase email OTP requires production SMTP/dashboard configuration.
- The library workspace has been split into smaller responsibility-focused
  components.
