/**
 * Planning-lifecycle backpressure (see BACKPRESSURE.md → "Planning is
 * backpressure too" and AGENTS.md working rule #1).
 *
 * Fails `bun run check` when the two-location planning system drifts:
 *   1. Orphan design artifact — a docs/superpowers/{plans,specs}/*.md file that
 *      no exec plan under docs/exec-plans/ references. A spec must inform an
 *      exec plan before a build.
 *   2. Unindexed bucket — a version/phase bucket under docs/exec-plans/
 *      {queued,active,completed,archive}/* that holds plans but is not linked
 *      from docs/PLANS.md (or a loose plan sitting outside any bucket).
 *
 * Pure docs lint: no DB, no network. Runs in CI's DB-free quality gate.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const execPlansDir = join(repoRoot, "docs", "exec-plans");
const superpowersDir = join(repoRoot, "docs", "superpowers");
const plansIndexFile = join(repoRoot, "docs", "PLANS.md");

const LIFECYCLES = ["queued", "active", "completed", "archive"];

function walkMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Invariant 1: every superpowers spec/plan is referenced by an exec plan. */
function findOrphanArtifacts(): string[] {
  const execPlanContent = walkMarkdown(execPlansDir)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  const artifacts = [
    ...walkMarkdown(join(superpowersDir, "plans")),
    ...walkMarkdown(join(superpowersDir, "specs")),
  ];

  const errors: string[] = [];
  for (const artifact of artifacts) {
    const name = basename(artifact);
    if (!execPlanContent.includes(name)) {
      errors.push(
        `orphan design artifact: docs/superpowers/.../${name} is referenced by no exec plan under docs/exec-plans/. ` +
          "Create or update an exec plan that links to it (AGENTS.md working rule #1).",
      );
    }
  }
  return errors;
}

/** Invariant 2: every populated bucket is indexed in PLANS.md; none sit loose. */
function findUnindexedBuckets(): string[] {
  const plansContent = readFileSync(plansIndexFile, "utf8");
  const errors: string[] = [];

  for (const lifecycle of LIFECYCLES) {
    const lifecycleDir = join(execPlansDir, lifecycle);
    if (!existsSync(lifecycleDir)) continue;

    for (const entry of readdirSync(lifecycleDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          errors.push(
            `loose plan: docs/exec-plans/${lifecycle}/${entry.name} is not inside a version/phase bucket (docs/PLANS.md bucket rule).`,
          );
        }
        continue;
      }

      const populated = walkMarkdown(join(lifecycleDir, entry.name)).length > 0;
      if (!populated) continue;

      const needle = `${lifecycle}/${entry.name}/`;
      if (!plansContent.includes(needle)) {
        errors.push(
          `unindexed bucket: docs/exec-plans/${lifecycle}/${entry.name}/ holds plans but is not linked from docs/PLANS.md ` +
            `(expected a link path containing "${needle}").`,
        );
      }
    }
  }
  return errors;
}

const errors = [...findOrphanArtifacts(), ...findUnindexedBuckets()];

if (errors.length > 0) {
  console.error("✗ planning-lifecycle check failed:\n");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error(
    `\n${errors.length} violation(s). See AGENTS.md working rule #1 and BACKPRESSURE.md.`,
  );
  process.exit(1);
}

console.log(
  "✓ planning-lifecycle: every superpowers spec/plan is referenced by an exec plan, and every bucket is indexed in PLANS.md.",
);
