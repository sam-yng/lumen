#!/usr/bin/env bun
/**
 * Regenerates docs/generated/db-schema.md from supabase/migrations/*.sql.
 *
 * This is the source-of-truth docs mirror of the schema. It is GENERATED —
 * never hand-edit the output. Run via `bun run docs:db-schema`.
 *
 * The parser is intentionally lightweight: it recognises `create table`,
 * `alter table ... enable row level security`, and `create policy` statements.
 * It does not attempt to be a full SQL parser.
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

/** Extract the parenthesised body of `create table <name> ( ... )`. */
function parseTables(sql: string): Map<string, Table> {
  const tables = new Map<string, Table>();
  const re =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?\w+"?)\s*\(/gi;
  let match: RegExpExecArray | null;

  match = re.exec(sql);
  while (match !== null) {
    const name = match[1].replace(/"/g, "");
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
    const body = sql.slice(start, i);
    tables.set(name, {
      name,
      columns: parseColumns(body),
      rls: false,
      policies: [],
    });
    match = re.exec(sql);
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

function main(): void {
  const sql = readMigrations();
  const tables = parseTables(sql);
  applyRlsAndPolicies(sql, tables);
  writeFileSync(OUTPUT, `${render(tables)}\n`);
  console.log(`Wrote ${OUTPUT} (${tables.size} tables).`);
}

main();
