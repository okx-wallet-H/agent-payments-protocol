import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const stagingDeployment = await readFile("docs/STAGING_SERVER_DEPLOYMENT.md", "utf8");
const storageMigration = await readFile("docs/STORAGE_MIGRATION.md", "utf8");

const scripts = packageJson.scripts || {};
const checks = [];

const requiredScripts = [
  "smoke:supabase-staging-sequence",
  "smoke:supabase-cutover-safety",
  "smoke:supabase-rollback-plan",
  "smoke:supabase-closeout",
  "smoke:staging-readiness",
  "smoke:staging-server",
  "smoke:staging-storage-summary",
  "smoke:staging-auth-surface",
  "smoke:hwallet-dual-observation:live",
  "smoke:hwallet-dual-consistency:live",
  "smoke:hwallet-postgres-api:live",
  "smoke:hwallet-postgres-performance:live",
  "smoke:mobile-staging-env"
];

for (const scriptName of requiredScripts) {
  assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
}
assert(
  String(scripts["verify:merge"] || "").includes("smoke:supabase-staging-sequence"),
  "verify:merge includes Supabase staging sequence gate"
);
checks.push("package exposes and runs Supabase staging sequence gate");

const releaseGate = sectionFrom(releaseChecklist, "Supabase staging stability gate:");
assertOrder(releaseGate, "npm run smoke:supabase-cutover-safety", "npm run smoke:supabase-closeout", "static gate comes before live closeout");
assertOrder(releaseGate, "npm run smoke:supabase-closeout", "HWALLET_SESSION_STORE=dual npm run dev", "live closeout comes before dual server");
assertOrder(releaseGate, "HWALLET_SESSION_STORE=dual npm run dev", "smoke:hwallet-dual-observation:live", "dual server comes before dual observation");
assertOrder(releaseGate, "smoke:hwallet-dual-observation:live", "smoke:hwallet-dual-consistency:live", "dual observation comes before consistency");
assertOrder(releaseGate, "smoke:hwallet-dual-consistency:live", "HWALLET_SESSION_STORE=postgres npm run dev", "dual consistency comes before postgres server");
assertOrder(releaseGate, "HWALLET_SESSION_STORE=postgres npm run dev", "smoke:hwallet-postgres-api:live", "postgres server comes before postgres API readback");
assertOrder(releaseGate, "smoke:hwallet-postgres-api:live", "smoke:hwallet-postgres-performance:live", "postgres readback comes before performance");
assertOrder(
  releaseGate,
  "smoke:hwallet-postgres-performance:live",
  "MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env",
  "performance comes before mobile staging build gate"
);
checks.push("release checklist keeps Supabase staging validation in safe order");

assertPattern(releaseGate, /run the performance gate a second time/i, "release checklist documents performance retry");
assertPattern(releaseGate, /same endpoint fails again/i, "release checklist blocks repeated endpoint latency failures");
assertPattern(
  releaseGate,
  /keep\s+`HWALLET_SESSION_STORE=dual`\s+or\s+`jsonl`/i,
  "release checklist documents rollback storage mode"
);
assertPattern(releaseGate, /do not publish an EAS Update/i, "release checklist blocks OTA when staging is unhealthy");
assertPattern(releaseGate, /do not\s+enable live execution/i, "release checklist keeps live execution closed");
checks.push("release checklist documents retry, rollback, OTA, and execution safety");

assertIncludes(stagingDeployment, "npm run smoke:supabase-staging-sequence", "staging deployment references sequence smoke");
assertIncludes(stagingDeployment, "STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-auth-surface", "staging deployment keeps auth surface gate");
assertIncludes(stagingDeployment, "EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env", "staging deployment keeps mobile staging env gate");
assertPattern(stagingDeployment, /Keep live execution closed/i, "staging deployment keeps live execution closed");
checks.push("staging deployment keeps the same safety sequence visible");

assertIncludes(storageMigration, "smoke:hwallet-dual-observation:live", "storage migration includes dual observation");
assertIncludes(storageMigration, "smoke:hwallet-dual-consistency:live", "storage migration includes dual consistency");
assertIncludes(storageMigration, "smoke:hwallet-postgres-api:live", "storage migration includes postgres readback");
assertIncludes(storageMigration, "smoke:hwallet-postgres-performance:live", "storage migration includes postgres performance");
checks.push("storage migration keeps live Supabase gates documented");

assertNoRawSecrets({
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/STAGING_SERVER_DEPLOYMENT.md": stagingDeployment,
  "docs/STORAGE_MIGRATION.md": storageMigration
});
checks.push("staging sequence docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  requiredScripts: requiredScripts.length
}, null, 2));

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), label);
}

function assertPattern(text, pattern, label) {
  assert(pattern.test(text), label);
}

function assertOrder(text, first, second, label) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert(firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex, label);
}

function sectionFrom(text, marker) {
  const start = text.indexOf(marker);
  assert(start !== -1, `${marker} section exists`);
  const nextHeading = text.indexOf("\n## ", start + marker.length);
  return nextHeading === -1 ? text.slice(start) : text.slice(start, nextHeading);
}

function assertNoRawSecrets(files) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      assert(!pattern.test(text), `${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Supabase staging sequence smoke failed: ${label}`);
}
