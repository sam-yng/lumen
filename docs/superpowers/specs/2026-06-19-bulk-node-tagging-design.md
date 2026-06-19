# Bulk Node Tagging — Design

**Date:** 2026-06-19
**Status:** approved (brainstorm)
**Area:** library selection, tags
**Exec plan:** [`bulk-node-tagging.md`](../../exec-plans/active/cross-cutting/bulk-node-tagging.md)

## Problem

Tags can be created, managed, and used as library filters, and the data model
can link a tag to any `library_nodes` row. The library UI does not expose a way
to attach or remove those tags from selected nodes. Users need one consistent
bulk editor for workspaces, folders, notes, imported PDFs, and audio files.

## Decisions (binding)

- Add a **Tags** dropdown to `library-actions.tsx`. The button is always visible
  wherever `LibraryActions` is rendered and is disabled until at least one node
  is selected. It remains visible and disabled while a tag mutation is pending.
- List every created tag with its color, name, and a tri-state checkbox:
  - checked: every selected node has the tag;
  - indeterminate: some selected nodes have the tag;
  - unchecked: no selected nodes have the tag.
- Clicking checked removes the tag from every selected node. Clicking
  indeterminate or unchecked applies it to every selected node missing it.
- Keep the dropdown open after a checkbox change so several tags can be edited
  quickly.
- If no tags exist, the enabled menu says `No tags created yet`. Tag creation
  remains in the existing sidebar tag panel.
- Selection remains intact after success or failure. The library snapshot is
  invalidated after every settled mutation so the menu reflects persisted
  state; failures render as an inline library-action error.
- All `library_nodes` kinds are taggable, including root workspaces.

## Architecture

Selection currently belongs to `LibraryContent`, while `LibraryActions` is its
sibling. Lift the selected-ID set into `LibraryWorkspace`, keep row gestures and
Move/Delete/Clear orchestration in `LibraryContent`, and pass the selection into
`LibraryActions`. A pure helper derives each checkbox state from the selected
IDs and snapshot `tagLinks`.

Add a single bulk API operation accepting `{ tagId, nodeIds, linked }`. The
service authenticates the tag and all unique nodes against `ctx.userId`, then
inserts only missing links or deletes the matching links. Repeating the same
desired state is safe. The endpoint avoids one browser request per selected
node and stays reusable by future service consumers.

No schema migration is required: `tag_links(tag_id, node_id)` already has a
unique index and cascades when either side is deleted.

## Components and data flow

1. Row selection updates the selected-ID set owned by `LibraryWorkspace`.
2. `LibraryActions` receives `selectedNodeIds`, `tags`, `tagLinks`, pending
   state, and an `onSetTag` callback.
3. For each tag, the pure helper counts links across selected IDs and returns
   `false`, `"indeterminate"`, or `true`.
4. Selecting a menu item requests `linked: false` only when its state was
   `true`; the other two states request `linked: true`.
5. TanStack Query runs the bulk request, invalidates `["library"]` when it
   settles, and preserves selection. The menu is disabled during the request.

## Error handling

- Reject an empty node list or invalid IDs at the route boundary.
- Reject a foreign/missing tag or any foreign/missing node in the service; do
  not silently operate on a subset.
- Surface the mutation error next to `LibraryActions` and refresh the snapshot
  after settlement. This makes a rare partial database outcome visible without
  discarding the user's selection.

## Testing and verification

- Unit-test checkbox-state derivation for zero, partial, and complete coverage.
- Component-test the always-visible disabled trigger, tag colors/names, all
  three states, click semantics, menu persistence, pending state, and empty
  tags message.
- Service-test ownership, deduplication, idempotent linking, missing-link-only
  inserts, and bulk unlinking.
- Integration-test selection propagation and preservation around success and
  failure.
- Run `bun run check`, then browser-test single selection, mixed multi-select,
  applying several tags, removing a tag, error visibility, and the disabled
  zero-selection state.

## Out of scope

- Creating, renaming, or deleting tags from the dropdown.
- Automatically tagging descendants when a container is tagged.
- Changing tag-filter OR semantics.
- Optimistic tag-link updates.
