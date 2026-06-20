import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const routePath = path.join(repoRoot, "app", "api", "agents", "route.ts");
const packagePath = path.join(repoRoot, "package.json");
const route = fs.readFileSync(routePath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const checks = [];

check(route.includes("agents: user.userId ? agents.filter"), "GET filters agents by resolved user id");
check(route.includes(": []"), "GET returns an empty list when no owner is resolved");
check(route.includes("ownerUserId is required to create an Agent"), "POST rejects ownerless Agent creation");
check(!route.includes('|| "demo-user"'), "POST no longer falls back to demo-user owner");
check(!route.includes("ownerUserId: user.userId || body.ownerUserId ||"), "POST no longer chains through owner demo fallback");
check(
  packageJson.scripts?.["smoke:agents-owner-boundary"] === "node v2/scripts/smoke-agents-owner-boundary.mjs",
  "package.json exposes agents owner boundary smoke"
);
check(
  packageJson.scripts?.["verify:merge"]?.includes("smoke:agents-owner-boundary"),
  "verify:merge includes agents owner boundary smoke"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks
    },
    null,
    2
  )
);

function check(condition, label) {
  if (!condition) throw new Error(`agents owner boundary smoke failed: ${label}`);
  checks.push(label);
}
