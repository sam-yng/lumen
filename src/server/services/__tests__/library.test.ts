import { describe, expect, it } from "vitest";
import {
  createContext,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { createDocument, updateDocument } from "@/server/services/documents";
import { extractTipTapText } from "@/server/services/editor-content";
import { createFileMetadata } from "@/server/services/files";
import {
  createFolder,
  deleteFolder,
  moveFolder,
} from "@/server/services/folders";
import { getLibrarySnapshot } from "@/server/services/library";
import { createTag, linkTagToTarget } from "@/server/services/tags";

describe("library services", () => {
  it("returns a unified snapshot scoped to the current user", async () => {
    const ctx = createContext({
      folders: [
        { id: "folder-a", user_id: userId, name: "Course notes" },
        { id: "folder-b", user_id: otherUserId, name: "Someone else" },
      ],
      documents: [
        { id: "doc-a", user_id: userId, title: "Photosynthesis" },
        { id: "doc-b", user_id: otherUserId, title: "Private" },
      ],
      files: [
        { id: "file-a", user_id: userId, name: "slides.pdf" },
        { id: "file-b", user_id: otherUserId, name: "other.pdf" },
      ],
      tags: [
        { id: "tag-a", user_id: userId, name: "biology" },
        { id: "tag-b", user_id: otherUserId, name: "math" },
      ],
      tag_links: [
        {
          id: "link-a",
          tag_id: "tag-a",
          target_type: "document",
          target_id: "doc-a",
        },
        {
          id: "link-b",
          tag_id: "tag-b",
          target_type: "document",
          target_id: "doc-b",
        },
      ],
    });

    const snapshot = await getLibrarySnapshot(ctx);

    expect(snapshot.folders.map((folder) => folder.id)).toEqual(["folder-a"]);
    expect(snapshot.documents.map((document) => document.id)).toEqual([
      "doc-a",
    ]);
    expect(snapshot.files.map((file) => file.id)).toEqual(["file-a"]);
    expect(snapshot.tags.map((tag) => tag.id)).toEqual(["tag-a"]);
    expect(snapshot.tagLinks.map((link) => link.id)).toEqual(["link-a"]);
  });

  it("rejects moving a folder into one of its descendants", async () => {
    const ctx = createContext({
      folders: [
        { id: "root", user_id: userId, parent_id: null, name: "Root" },
        { id: "child", user_id: userId, parent_id: "root", name: "Child" },
        {
          id: "grandchild",
          user_id: userId,
          parent_id: "child",
          name: "Grandchild",
        },
      ],
    });

    await expect(
      moveFolder(ctx, { id: "root", parentId: "grandchild" }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "A folder cannot be moved into itself or a descendant.",
    });
  });

  it("creates and deletes folders under the current user", async () => {
    const ctx = createContext({ folders: [] });

    const folder = await createFolder(ctx, {
      name: "Seminars",
      parentId: null,
    });

    expect(folder).toMatchObject({
      user_id: userId,
      name: "Seminars",
      parent_id: null,
    });

    const deleted = await deleteFolder(ctx, { id: String(folder.id) });

    expect(deleted.id).toBe(folder.id);
    expect(ctx.supabase).toMatchObject({
      tables: { folders: [] },
    });
  });

  it("creates documents under the current user and validates folder ownership", async () => {
    const ctx = createContext({
      folders: [
        { id: "owned-folder", user_id: userId, name: "Owned" },
        { id: "foreign-folder", user_id: otherUserId, name: "Foreign" },
      ],
      documents: [],
    });

    await expect(
      createDocument(ctx, {
        title: "Lecture outline",
        folderId: "foreign-folder",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Folder not found.",
    });

    const document = await createDocument(ctx, {
      title: "Lecture outline",
      folderId: "owned-folder",
    });

    expect(document).toMatchObject({
      user_id: userId,
      title: "Lecture outline",
      folder_id: "owned-folder",
      content_json: null,
      content_text: null,
    });
  });

  it("extracts plain text from nested TipTap JSON", () => {
    const text = extractTipTapText({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Lecture 3" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Cells " },
            { type: "text", text: "use ATP." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Mitochondria" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(text).toBe("Lecture 3 Cells use ATP. Mitochondria");
  });

  it("persists document content JSON and derived plain text", async () => {
    const ctx = createContext({
      documents: [
        {
          id: "doc-a",
          user_id: userId,
          title: "Lecture",
          folder_id: null,
          content_json: null,
          content_text: null,
        },
      ],
    });

    const contentJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Saved from TipTap" }],
        },
      ],
    };

    const document = await updateDocument(ctx, {
      id: "doc-a",
      contentJson,
    });

    expect(document).toMatchObject({
      id: "doc-a",
      content_json: contentJson,
      content_text: "Saved from TipTap",
    });
  });

  it("creates metadata-only file records for the current user", async () => {
    const ctx = createContext({
      folders: [{ id: "folder-a", user_id: userId, name: "Lectures" }],
      files: [],
    });

    const file = await createFileMetadata(ctx, {
      name: "week-01.pdf",
      mimeType: "application/pdf",
      sizeBytes: 42_000,
      kind: "other",
      folderId: "folder-a",
    });

    expect(file).toMatchObject({
      user_id: userId,
      folder_id: "folder-a",
      name: "week-01.pdf",
      mime_type: "application/pdf",
      size_bytes: 42_000,
      kind: "other",
      storage_key: "metadata/user-1/week-01-pdf",
    });
  });

  it("rejects duplicate tag names for the same user before inserting", async () => {
    const ctx = createContext({
      tags: [{ id: "tag-a", user_id: userId, name: "biology", color: null }],
    });

    await expect(
      createTag(ctx, { name: "biology", color: "#22c55e" }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "A tag with that name already exists.",
    });
  });

  it("rejects linking a tag to a target the current user does not own", async () => {
    const ctx = createContext({
      tags: [{ id: "tag-a", user_id: userId, name: "biology", color: null }],
      documents: [
        { id: "foreign-doc", user_id: otherUserId, title: "Private" },
      ],
      tag_links: [],
    });

    await expect(
      linkTagToTarget(ctx, {
        tagId: "tag-a",
        targetType: "document",
        targetId: "foreign-doc",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Target not found.",
    });
  });
});
