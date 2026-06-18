#!/usr/bin/env bun
/**
 * Regenerates docs/generated/db-schema.md from supabase/migrations/*.sql.
 *
 * This is the source-of-truth docs mirror of the schema. It is GENERATED —
 * never hand-edit the output. Run via `bun run docs:db-schema`.
 *
 * The parser is intentionally lightweight: it recognises `create table`,
 * `drop table`, `alter table ... rename to`,
 * `alter table ... enable row level security`, and `create policy` statements.
 * `create`/`drop`/`rename` are folded in source order so the emitted schema
 * reflects the final post-migration state. It does not attempt to be a full
 * SQL parser.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(SCRIPT_DIR, "..", "supabase", "migrations");
const OUTPUT = join(
  SCRIPT_DIR,
  "..",
  "..",
  "..",
  "docs",
  "generated",
  "db-schema.md",
);

type Column = { name: string; definition: string };
type Table = {
  name: string;
  columns: Column[];
  rls: boolean;
  policies: string[];
};

function readMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

type CreateEvent = {
  kind: "create";
  index: number;
  name: string;
  body: string;
};
type DropEvent = { kind: "drop"; index: number; name: string };
type RenameEvent = {
  kind: "rename";
  index: number;
  from: string;
  to: string;
};
type TableEvent = CreateEvent | DropEvent | RenameEvent;

const unquote = (raw: string): string => raw.replace(/"/g, "");

/** Collect `create table <name> ( ... )` events with their source positions. */
function collectCreateEvents(sql: string): CreateEvent[] {
  const events: CreateEvent[] = [];
  const re =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?\w+"?)\s*\(/gi;
  let match: RegExpExecArray | null = re.exec(sql);
  while (match !== null) {
    // Walk forward from the opening paren, tracking depth, to find its match.
    let depth = 0;
    let i = match.index + match[0].length - 1;
    const start = i + 1;
    for (; i < sql.length; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    events.push({
      kind: "create",
      index: match.index,
      name: unquote(match[1]),
      body: sql.slice(start, i),
    });
    match = re.exec(sql);
  }
  return events;
}

/** Collect `drop table [if exists] <name>[, <name>...]` events. */
function collectDropEvents(sql: string): DropEvent[] {
  const events: DropEvent[] = [];
  const re = /drop\s+table\s+(?:if\s+exists\s+)?([^;]+);/gi;
  for (const match of sql.matchAll(re)) {
    for (const ref of match[1].split(",")) {
      const name = unquote(ref.trim())
        .replace(/^public\./i, "")
        .replace(/\s+(cascade|restrict)\s*$/i, "")
        .trim();
      if (name) events.push({ kind: "drop", index: match.index, name });
    }
  }
  return events;
}

/** Collect `alter table <name> rename to <name>` (table rename) events. */
function collectRenameEvents(sql: string): RenameEvent[] {
  const events: RenameEvent[] = [];
  const re =
    /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?("?\w+"?)\s+rename\s+to\s+(?:public\.)?("?\w+"?)/gi;
  for (const match of sql.matchAll(re)) {
    events.push({
      kind: "rename",
      index: match.index,
      from: unquote(match[1]),
      to: unquote(match[2]),
    });
  }
  return events;
}

/**
 * Fold create/drop/rename events in source order into the final table set, so
 * dropped tables disappear and renamed tables move to their final name.
 */
export function parseTables(sql: string): Map<string, Table> {
  const tables = new Map<string, Table>();
  const events: TableEvent[] = [
    ...collectCreateEvents(sql),
    ...collectDropEvents(sql),
    ...collectRenameEvents(sql),
  ].sort((a, b) => a.index - b.index);

  for (const event of events) {
    if (event.kind === "create") {
      tables.set(event.name, {
        name: event.name,
        columns: parseColumns(event.body),
        rls: false,
        policies: [],
      });
    } else if (event.kind === "drop") {
      tables.delete(event.name);
    } else {
      const table = tables.get(event.from);
      if (!table) continue;
      tables.delete(event.from);
      table.name = event.to;
      tables.set(event.to, table);
    }
  }
  return tables;
}

const CONSTRAINT_STARTS = [
  "primary",
  "foreign",
  "constraint",
  "unique",
  "check",
  "references",
  "exclude",
];

/** Split a table body on top-level commas and keep the column definitions. */
function parseColumns(body: string): Column[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);

  const columns: Column[] = [];
  for (const raw of parts) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (!line) continue;
    const firstWord = line.split(" ")[0].toLowerCase();
    if (CONSTRAINT_STARTS.includes(firstWord)) continue;
    const name = line.split(" ")[0].replace(/"/g, "");
    const definition = line.slice(line.indexOf(" ") + 1).trim();
    columns.push({ name, definition });
  }
  return columns;
}

function applyRlsAndPolicies(sql: string, tables: Map<string, Table>): void {
  const rlsRe =
    /alter\s+table\s+(?:public\.)?("?\w+"?)\s+enable\s+row\s+level\s+security/gi;
  for (const m of sql.matchAll(rlsRe)) {
    const t = tables.get(m[1].replace(/"/g, ""));
    if (t) t.rls = true;
  }
  const polRe = /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?("?\w+"?)/gi;
  for (const m of sql.matchAll(polRe)) {
    const t = tables.get(m[2].replace(/"/g, ""));
    if (t) t.policies.push(m[1]);
  }
}

function applyAddedColumns(sql: string, tables: Map<string, Table>): void {
  const alterRe = /alter\s+table\s+(?:public\.)?("?\w+"?)\s+([\s\S]*?);/gi;

  for (const match of sql.matchAll(alterRe)) {
    const table = tables.get(match[1].replace(/"/g, ""));
    if (!table) continue;

    const body = match[2];
    const addColumnRe =
      /add\s+column\s+(?:if\s+not\s+exists\s+)?("?\w+"?)\s+([^,;]+?)(?=,\s*add\s+(?:column|constraint)\b|;|$)/gi;
    for (const columnMatch of body.matchAll(addColumnRe)) {
      const name = columnMatch[1].replace(/"/g, "");
      if (table.columns.some((column) => column.name === name)) continue;
      table.columns.push({
        name,
        definition: columnMatch[2].trim().replace(/\s+/g, " "),
      });
    }
  }
}

function render(tables: Map<string, Table>): string {
  const lines: string[] = [
    "<!-- GENERATED from apps/web/supabase/migrations/ by apps/web/scripts/gen-db-schema.ts — do not edit. -->",
    "<!-- Regenerate with `bun run docs:db-schema`. -->",
    "",
    "# Database schema",
    "",
    "## Tables",
    "",
  ];

  const sorted = [...tables.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (sorted.length === 0) {
    lines.push("_(none yet)_", "");
    return lines.join("\n");
  }

  for (const table of sorted) {
    lines.push(`### ${table.name}`, "");
    lines.push(`RLS: ${table.rls ? "enabled" : "**not enabled**"}`, "");
    lines.push("| Column | Definition |", "| --- | --- |");
    for (const col of table.columns) {
      lines.push(`| \`${col.name}\` | ${col.definition} |`);
    }
    lines.push("");
    if (table.policies.length > 0) {
      lines.push(
        `Policies: ${table.policies.map((p) => `\`${p}\``).join(", ")}`,
        "",
      );
    }
  }
  return lines.join("\n");
}

export function main(): void {
  const sql = readMigrations();
  const tables = parseTables(sql);
  applyAddedColumns(sql, tables);
  applyRlsAndPolicies(sql, tables);
  writeFileSync(OUTPUT, `${render(tables)}\n`);
  console.log(`Wrote ${OUTPUT} (${tables.size} tables).`);
}

if ((import.meta as { main?: boolean }).main) main();
