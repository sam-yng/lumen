# Product sense

Who Lumen is for and the judgment calls behind v1 scope.

- **User:** a student keeping a nested library of notes, files, and recorded
  lectures/seminars, who later wants AI help over that material.
- **v1 deliberately excludes** all AI/MCP features — it builds the product
  foundation and the harness, with clean seams for the AI layer (see
  [ARCHITECTURE.md](../ARCHITECTURE.md)).
- **Multi-tenant from day one:** built as if strangers will sign up; RLS is the
  isolation boundary.
- **Zero recurring cost:** no paid inference; transcription runs locally on CPU.

Status: stub — expand with concrete product decisions as features land.
