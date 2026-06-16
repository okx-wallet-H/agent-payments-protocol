import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const storageMigration = await readFile("docs/STORAGE_MIGRATION.md", "utf8");
const stagingDeployment = await readFile("docs/STAGING_SERVER_DEPLOYMENT.md", "utf8");
const deviceQa = await readFile("docs/HWALLET_DEVICE_MULTI_USER_QA.md", "utf8");
const dualObservationSmoke = await readFile("v2/scripts/smoke-hwallet-dual-observation-live.mjs", "utf8");
const dualConsistencySmoke = await readFile("v2/scripts/smoke-hwallet-dual-consistency-live.mjs", "utf8");
const postgresApiSmoke = await readFile("v2/scripts/smoke-hwallet-postgres-api-live.mjs", "utf8");
const postgresPerformanceSmoke = await readFile("v2/scripts/smoke-hwallet-postgres-performance-live.mjs", "utf8");

const scripts = packageJson.scripts || {};
const checks = [];

const requiredScripts = [
  "smoke:supabase-readback-drill",
  "smoke:supabase-closeout",
  "smoke:supabase-cutover-safety",
  "smoke:supabase-staging-sequence",
  "smoke:supabase-rollback-plan",
  "smoke:hwallet-dual-observation:live",
  "smoke:hwallet-dual-consistency:live",
  "smoke:hwallet-postgres-api:live",
  "smoke:hwallet-postgres-performance:live",
  "smoke:staging-storage-summary",
  "smoke:staging-auth-surface",
  "smoke:mobile-staging-env",
  "smoke:mobile-device-hwallet:live"
];

for (const scriptName of requiredScripts) {
  assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
}
assert(
  String(scripts["verify:merge"] || "").includes("smoke:supabase-readback-drill"),
  "verify:merge includes Supabase readback drill gate"
);
checks.push("package exposes and runs the Supabase readback drill gate");

const releaseDrill = sectionFrom(releaseChecklist, "Supabase staging readback drill:");
assertOrder(releaseDrill, "npm run smoke:supabase-closeout", "HWALLET_SESSION_STORE=dual npm run dev", "live closeout comes before dual server");
assertOrder(releaseDrill, "HWALLET_SESSION_STORE=dual npm run dev", "smoke:hwallet-dual-observation:live", "dual server comes before dual observation");
assertOrder(releaseDrill, "smoke:hwallet-dual-observation:live", "smoke:hwallet-dual-consistency:live", "dual observation comes before consistency");
assertOrder(releaseDrill, "smoke:hwallet-dual-consistency:live", "HWALLET_SESSION_STORE=postgres npm run dev", "dual consistency comes before postgres server");
assertOrder(releaseDrill, "HWALLET_SESSION_STORE=postgres npm run dev", "smoke:hwallet-postgres-api:live", "postgres server comes before postgres API readback");
assertOrder(releaseDrill, "smoke:hwallet-postgres-api:live", "smoke:hwallet-postgres-performance:live", "postgres API readback comes before performance");
assertOrder(releaseDrill, "smoke:hwallet-postgres-performance:live", "MOBILE_STAGING_READINESS=true", "performance comes before mobile staging config");
assertPattern(releaseDrill, /other user/i, "release drill mentions other-user isolation");
assertPattern(releaseDrill, /do not publish an EAS Update/i, "release drill blocks OTA on failed readback");
checks.push("release checklist keeps Supabase readback drill in safe order");

assertIncludes(storageMigration, "Supabase staging readback drill", "storage migration references the readback drill");
assertIncludes(storageMigration, "smoke:supabase-readback-drill", "storage migration references the static drill gate");
assertIncludes(stagingDeployment, "npm run smoke:supabase-readback-drill", "staging deployment references readback drill gate");
assertIncludes(stagingDeployment, "Supabase readback drill", "staging deployment names the readback drill");
assertIncludes(deviceQa, "Supabase readback drill", "device QA references Supabase readback before App validation");
checks.push("storage, staging, and device docs point to the same Supabase readback drill");

assertPattern(dualObservationSmoke, /other user stays isolated/i, "dual observation checks other-user isolation");
assertPattern(
  dualObservationSmoke,
  /postgres mirror contains wallet, transfer, messages, audit, records/i,
  "dual observation checks postgres mirror coverage"
);
assertPattern(dualConsistencySmoke, /other user stays isolated in both stores/i, "dual consistency checks isolation in both stores");
assertPattern(dualConsistencySmoke, /JSONL and Postgres audit events match/i, "dual consistency compares audit events");
assertPattern(dualConsistencySmoke, /JSONL and Postgres both contain knowledge notes/i, "dual consistency compares Agent memory");
assertPattern(postgresApiSmoke, /other user stays isolated/i, "postgres API readback checks other-user isolation");
assertPattern(postgresApiSmoke, /tracking idempotency reads existing postgres record/i, "postgres API readback checks idempotency");
assertPattern(postgresApiSmoke, /memory API reads wallet and chat from postgres/i, "postgres API readback checks memory");
assertPattern(postgresApiSmoke, /audit API reads wallet and tracking events from postgres/i, "postgres API readback checks audit");
assertPattern(postgresPerformanceSmoke, /pool settings stay Supabase-safe/i, "postgres performance checks pool safety");
checks.push("live readback scripts cover mirror, isolation, idempotency, memory, audit, and pool safety");

assertNoRawSecrets({
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/STORAGE_MIGRATION.md": storageMigration,
  "docs/STAGING_SERVER_DEPLOYMENT.md": stagingDeployment,
  "docs/HWALLET_DEVICE_MULTI_USER_QA.md": deviceQa
});
checks.push("Supabase readback drill docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  requiredScripts: requiredScripts.length
}, null, 2));

function sectionFrom(text, marker) {
  const start = text.indexOf(marker);
  assert(start !== -1, `${marker} section exists`);
  const nextHeading = text.indexOf("\n## ", start + marker.length);
  return nextHeading === -1 ? text.slice(start) : text.slice(start, nextHeading);
}

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

function assertNoRawSecrets(files) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Supabase readback drill smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Supabase readback drill smoke failed: ${label}`);
  checks.push(label);
}
