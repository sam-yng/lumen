import type { Json } from "@/server/db/database.types";

type JsonRecord = { [key: string]: Json | undefined };

function isRecord(value: Json): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(parts: string[]) {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function collectText(value: Json, parts: string[]) {
  if (Array.isArray(value)) {
    for (const child of value) collectText(child, parts);
    return;
  }

  if (!isRecord(value)) return;

  const text = value.text;
  if (typeof text === "string") parts.push(text);

  const content = value.content;
  if (content !== undefined) collectText(content, parts);
}

export function extractTipTapText(contentJson: Json | null) {
  if (contentJson === null) return null;

  const parts: string[] = [];
  collectText(contentJson, parts);
  return normalizeText(parts);
}

export function defaultTipTapDocument(text: string | null): JsonRecord {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}
