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

export type TipTapTextBlock = {
  blockIndex: number;
  text: string;
};

export function extractTipTapTextBlocks(contentJson: Json | null) {
  if (contentJson === null || !isRecord(contentJson)) return [];

  const content = contentJson.content;
  if (!Array.isArray(content)) return [];

  const blocks: TipTapTextBlock[] = [];
  content.forEach((child, blockIndex) => {
    const parts: string[] = [];
    collectText(child, parts);
    const text = normalizeText(parts);
    if (text.length > 0) blocks.push({ blockIndex, text });
  });
  return blocks;
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
