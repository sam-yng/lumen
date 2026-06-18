import { describe, expect, it } from "vitest";
import { parseTables } from "../gen-db-schema";

describe("parseTables", () => {
  it("parses a basic create table", () => {
    const sql = `create table public.notes (
      id uuid primary key,
      title text not null
    );`;
    const tables = parseTables(sql);
    expect([...tables.keys()]).toEqual(["notes"]);
    expect(tables.get("notes")?.columns.map((c) => c.name)).toEqual([
      "id",
      "title",
    ]);
  });

  it("removes tables dropped by a later migration", () => {
    const sql = `
      create table public.documents ( id uuid primary key );
      create table public.files ( id uuid primary key );
      create table public.folders ( id uuid primary key );
      create table public.library_nodes ( id uuid primary key );
      drop table public.documents;
      drop table public.files;
      drop table public.folders;
    `;
    const tables = parseTables(sql);
    expect([...tables.keys()]).toEqual(["library_nodes"]);
  });

  it("honours `drop table if exists` and a comma-separated drop list", () => {
    const sql = `
      create table public.a ( id uuid );
      create table public.b ( id uuid );
      create table public.c ( id uuid );
      drop table if exists public.a;
      drop table public.b, public.c cascade;
    `;
    expect(parseTables(sql).size).toBe(0);
  });

  it("does not drop a table that is recreated after the drop", () => {
    const sql = `
      create table public.t ( id uuid );
      drop table public.t;
      create table public.t ( id uuid, name text );
    `;
    const tables = parseTables(sql);
    expect(tables.get("t")?.columns.map((c) => c.name)).toEqual(["id", "name"]);
  });

  it("follows `alter table ... rename to`", () => {
    const sql = `
      create table public.old_name ( id uuid );
      alter table public.old_name rename to new_name;
    `;
    const tables = parseTables(sql);
    expect([...tables.keys()]).toEqual(["new_name"]);
    expect(tables.get("new_name")?.name).toBe("new_name");
  });
});
