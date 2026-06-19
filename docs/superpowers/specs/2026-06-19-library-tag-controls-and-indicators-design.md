# Library Tag Controls and Indicators — Design

**Date:** 2026-06-19
**Status:** approved (brainstorm)
**Area:** library selection, tag visibility
**Exec plan:** [`library-tag-controls-and-indicators.md`](../../exec-plans/completed/cross-cutting/library-tag-controls-and-indicators.md)

## Problem

Bulk tag assignment currently lives in the library creation toolbar even though
it operates on selected nodes alongside Move, Delete, and Clear. Library rows
also provide no immediate indication of which tags are assigned to a node.
Color alone is insufficient because multiple tags may share a color.

## Decisions (binding)

- Move the existing **Tags** dropdown out of `library-actions.tsx` and into
  `library-item-actions.tsx`, immediately after **Move**.
- Preserve the existing bulk-tag behavior: disabled without a selection or
  during a tag mutation, tri-state checkboxes, a persistent menu while toggling
  multiple tags, and the `No tags created yet` empty state.
- Move the inline tag-mutation error with the dropdown so feedback remains next
  to the control that initiated the operation.
- Show assigned tag names at the right edge of every tagged library node row.
- Render at most three tag-name chips, followed by a `+N` overflow chip when
  more tags are assigned.
- Keep the tag region single-line and non-wrapping. Tag assignment must not
  change row height or otherwise reshape the node list.
- Truncate long chip labels within the available right-side space while keeping
  the full tag name available through accessible text and a native title.
- Preserve the order of the library snapshot's tag list so chip order is stable
  across rows and refreshes.
- Untagged nodes render no tag region.

## Architecture

`LibraryWorkspace` remains the owner of the selected node IDs and the bulk tag
mutation. It will derive a node-to-tags lookup once from the snapshot's `tags`
and `tagLinks`, preserving tag-list order, and pass that lookup into
`LibraryContent`. Each `ItemRow` receives only its assigned tag records and
renders them; it does not join or scan the full snapshot itself.

`LibraryContent` will receive the tags, links, mutation state, mutation error,
and tag callback needed by `LibraryItemActions`. This keeps selection actions
and their feedback in one component while leaving create/upload actions in
`LibraryActions`.

No service, route, database, or mutation-contract changes are required. The
existing `setTagForNodes` request and `tagSelectionState` helper remain the
source of bulk assignment behavior.

## Components and data flow

1. `LibraryWorkspace` receives `tags` and `tagLinks` in the library snapshot.
2. A pure helper builds a lookup from node ID to ordered assigned tags.
3. `LibraryWorkspace` passes tag controls and the lookup to `LibraryContent`.
4. `LibraryItemActions` renders Move, Tags, Delete, and Clear in that order.
5. The Tags dropdown derives each checkbox state from the current selection and
   invokes the existing bulk mutation callback.
6. `LibraryContent` passes each visible node's assigned tags to `ItemRow`.
7. `ItemRow` renders the first three names and a `+N` chip at the fixed right
   edge without wrapping or changing row height.

## Responsive and accessibility behavior

- The row's title/meta block remains the flexible region; the tag region stays
  right-aligned, bounded, and single-line.
- Individual tag chips use bounded widths and ellipsis so long labels cannot
  push the row taller.
- Each visible chip exposes its complete tag name via `title` and an accessible
  label even when the text is visually truncated.
- The overflow chip announces the number of additional tags and exposes their
  names in its accessible label/title so hidden assignments remain discoverable.
- Existing row button semantics, selected state, click modifiers, and
  double-click navigation remain unchanged.

## Error handling

- Existing mutation failures remain inline and selection remains intact.
- Missing or stale tag links are ignored when building the lookup because no
  corresponding tag name can be presented.
- An empty assignment renders no placeholder, preserving the current row.

## Testing and verification

- Component-test that the Tags dropdown is absent from `LibraryActions` and is
  present after Move in `LibraryItemActions`.
- Preserve tests for disabled, pending, empty, checked, indeterminate,
  unchecked, and keep-open dropdown behavior at the new component boundary.
- Unit-test the node-to-tags lookup for assignment, stable ordering, missing
  tags, and untagged nodes.
- Component-test one to three named chips, the three-chip cap, `+N` overflow,
  full accessible names, and the absence of a tag region for untagged rows.
- Regression-test selection, modifier clicks, and double-click navigation.
- Run `bun run check`, then browser-test tag assignment/removal, mixed bulk
  state, long names, four-or-more tags, and stable row height.

## Out of scope

- Changing bulk tag mutation semantics or APIs.
- Editing or creating tags from the bulk dropdown.
- Making row chips interactive or using them as filters.
- Showing tag colors as the primary identity.
- Expanding rows to reveal every assigned tag.
