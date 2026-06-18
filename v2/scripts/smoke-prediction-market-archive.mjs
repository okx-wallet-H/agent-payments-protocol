import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const archived = [
  {
    oldPath: "v2/scripts/preview-live-dry-run.mjs",
    archivePath: "archive/manual/prediction-market-preview/v2-scripts/preview-live-dry-run.mjs",
    token: "preview-live-dry-run"
  },
  {
    oldPath: "v2/scripts/preview-live-worldcup.mjs",
    archivePath: "archive/manual/prediction-market-preview/v2-scripts/preview-live-worldcup.mjs",
    token: "preview-live-worldcup"
  },
  {
    oldPath: "v2/scripts/demo-flow.mjs",
    archivePath: "archive/manual/prediction-market-preview/v2-scripts/demo-flow.mjs",
    token: "demo-flow"
  },
  {
    oldPath: "v2/scripts/preview-card-actions.mjs",
    archivePath: "archive/manual/prediction-market-preview/v2-scripts/preview-card-actions.mjs",
    token: "preview-card-actions"
  },
  {
    oldPath: "v2/scripts/preview-app-shell-panels.mjs",
    archivePath: "archive/manual/prediction-market-preview/v2-scripts/preview-app-shell-panels.mjs",
    token: "preview-app-shell-panels"
  },
  {
    oldPath: "apps/mobile/assets/world-cup-poster.png",
    archivePath: "archive/manual/prediction-market-preview/mobile-assets/world-cup-poster.png",
    token: "world-cup-poster"
  }
];

const scanRoots = ["app", "apps", "components", "docs", "lib", "scripts", "v2"];
const ignoredFiles = new Set([
  "docs/PREDICTION_MARKET_CLEANUP_QUEUE.md",
  "v2/scripts/smoke-prediction-market-archive.mjs"
]);
const ignoredDirs = new Set([
  ".git",
  ".codegraph",
  "archive",
  "node_modules",
  ".next",
  "dist",
  "build"
]);

function exists(relativePath) {
  return existsSync(path.join(repoRoot, relativePath));
}

async function* walk(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!exists(relativeDir)) return;

  for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      yield* walk(relativePath);
      continue;
    }
    if (entry.isFile()) yield relativePath;
  }
}

const checks = [];

for (const item of archived) {
  checks.push(`${item.oldPath} is absent from active tree`);
  assert.equal(exists(item.oldPath), false, `${item.oldPath} should be archived out of active tree`);

  checks.push(`${item.archivePath} exists in manual archive`);
  assert.equal(exists(item.archivePath), true, `${item.archivePath} should exist`);
}

const forbiddenRefs = [];
for (const root of scanRoots) {
  for await (const filePath of walk(root)) {
    const normalizedPath = filePath.split(path.sep).join("/");
    if (ignoredFiles.has(normalizedPath)) continue;
    const content = await readFile(path.join(repoRoot, filePath), "utf8").catch(() => "");
    for (const item of archived) {
      if (content.includes(item.token) || content.includes(item.oldPath)) {
        forbiddenRefs.push(`${normalizedPath}: ${item.token}`);
      }
    }
  }
}

checks.push("active app/api/docs tree does not reference archived preview files");
assert.deepEqual(forbiddenRefs, [], `archived preview files still referenced: ${forbiddenRefs.join(", ")}`);

const cleanupDoc = await readFile(path.join(repoRoot, "docs", "PREDICTION_MARKET_CLEANUP_QUEUE.md"), "utf8");
checks.push("cleanup queue records archive completion");
assert.match(cleanupDoc, /Archived on 2026-06-18/, "cleanup queue should record archive completion");

console.log(
  JSON.stringify(
    {
      ok: true,
      archived: archived.map((item) => item.archivePath),
      checks
    },
    null,
    2
  )
);
