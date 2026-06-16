import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const storageMigration = await readFile("docs/STORAGE_MIGRATION.md", "utf8");
const databaseDesign = await readFile("docs/HWALLET_DATABASE_DESIGN.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const stagingDeployment = await readFile("docs/STAGING_SERVER_DEPLOYMENT.md", "utf8");
const dualObservationSmoke = await readFile("v2/scripts/smoke-hwallet-dual-observation-live.mjs", "utf8");
const dualConsistencySmoke = await readFile("v2/scripts/smoke-hwallet-dual-consistency-live.mjs", "utf8");
const postgresApiSmoke = await readFile("v2/scripts/smoke-hwallet-postgres-api-live.mjs", "utf8");
const postgresPerformanceSmoke = await readFile("v2/scripts/smoke-hwallet-postgres-performance-live.mjs", "utf8");

const scripts = packageJson.scripts || {};
const checks = [];

const requiredScripts = [
  "db:migrate:postgres",
  "smoke:supabase-closeout",
  "smoke:hwallet-dual-api:live",
  "smoke:hwallet-dual-observation:live",
  "smoke:hwallet-dual-consistency:live",
  "smoke:hwallet-postgres-api:live",
  "smoke:hwallet-postgres-performance:live",
  "smoke:staging-readiness",
  "smoke:staging-server",
  "smoke:staging-storage-summary",
  "smoke:staging-auth-surface",
  "smoke:supabase-rollback-plan"
];

for (const scriptName of requiredScripts) {
  assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
}
checks.push("package exposes Supabase cutover scripts");

assertIncludes(storageMigration, "HWALLET_SESSION_STORE=dual", "storage migration documents dual mode");
assertIncludes(storageMigration, "HWALLET_SESSION_STORE=postgres", "storage migration documents postgres mode");
assertIncludes(storageMigration, "HWALLET_SESSION_STORE=jsonl", "storage migration documents jsonl rollback");
assertOrder(
  storageMigration,
  "HWALLET_SESSION_STORE=dual",
  "HWALLET_SESSION_STORE=postgres",
  "storage migration keeps dual before postgres cutover"
);
checks.push("storage migration keeps staged jsonl/dual/postgres path");

assertIncludes(storageMigration, "npm run smoke:supabase-cutover-safety", "storage migration documents static cutover gate");
assertIncludes(storageMigration, "npm run smoke:supabase-closeout", "storage migration documents live closeout gate");
assertIncludes(storageMigration, "smoke:hwallet-dual-observation:live", "storage migration documents dual observation smoke");
assertIncludes(storageMigration, "smoke:hwallet-dual-consistency:live", "storage migration documents dual consistency smoke");
assertIncludes(storageMigration, "smoke:hwallet-postgres-api:live", "storage migration documents postgres API smoke");
assertIncludes(storageMigration, "smoke:hwallet-postgres-performance:live", "storage migration documents postgres performance smoke");
checks.push("storage migration documents required validation gates");

assertPattern(dualObservationSmoke, /memory endpoint returns verified transfer/i, "dual observation reads verified transfers");
assertPattern(dualObservationSmoke, /audit endpoint returns wallet tx event/i, "dual observation reads audit tx events");
assertPattern(dualObservationSmoke, /records endpoint returns tracking record/i, "dual observation reads tracking records");
assertPattern(dualObservationSmoke, /other user stays isolated/i, "dual observation checks user isolation");
assertPattern(
  dualObservationSmoke,
  /postgres mirror contains wallet, transfer, messages, audit, records/i,
  "dual observation confirms postgres mirror coverage"
);

assertPattern(dualConsistencySmoke, /JSONL and Postgres wallet addresses match/i, "dual consistency compares wallet addresses");
assertPattern(dualConsistencySmoke, /JSONL and Postgres both contain verified transfer/i, "dual consistency compares transfers");
assertPattern(dualConsistencySmoke, /JSONL and Postgres tracking titles match/i, "dual consistency compares records");
assertPattern(dualConsistencySmoke, /JSONL and Postgres audit events match/i, "dual consistency compares audit events");
assertPattern(dualConsistencySmoke, /Postgres audit keeps money_moved=false/i, "dual consistency keeps audit no-money flag");
assertPattern(dualConsistencySmoke, /JSONL and Postgres both contain knowledge notes/i, "dual consistency compares Agent memory");
assertPattern(dualConsistencySmoke, /other user stays isolated in both stores/i, "dual consistency checks both-store isolation");

assertPattern(postgresApiSmoke, /wallet endpoint reads bound wallet from postgres/i, "postgres API reads wallet binding");
assertPattern(postgresApiSmoke, /memory API reads wallet and chat from postgres/i, "postgres API reads memory");
assertPattern(postgresApiSmoke, /audit API reads wallet and tracking events from postgres/i, "postgres API reads audit");
assertPattern(postgresApiSmoke, /records API reads tracking record from postgres/i, "postgres API reads records");
assertPattern(postgresApiSmoke, /other user stays isolated/i, "postgres API checks user isolation");
assertPattern(postgresPerformanceSmoke, /pool settings stay Supabase-safe/i, "postgres performance checks pool safety");
checks.push("live readback gates cover dual mirror, postgres read path, user isolation, audit, memory, and records");

assertPattern(storageMigration, /\bpg_dump\b|managed Supabase backup/i, "storage migration documents backup before cutover");
assertPattern(storageMigration, /rollback|roll back|回滚/i, "storage migration documents rollback");
assertPattern(storageMigration, /Never paste the real `DATABASE_URL`|without exposing any secrets|不暴露/i, "storage migration documents secret hygiene");
checks.push("storage migration documents backup, rollback, and secret hygiene");

assertPattern(databaseDesign, /RLS/i, "database design documents RLS");
assertPattern(databaseDesign, /unique \(user_id, chain_id\)/i, "database design documents one wallet per user and chain");
assertPattern(databaseDesign, /money_moved.*false/i, "database design documents no-money default");
assertPattern(databaseDesign, /export_allowed.*false/i, "database design documents TEE no-export guard");
checks.push("database design preserves production safety constraints");

assertPattern(releaseChecklist, /smoke:staging-auth-surface/i, "release checklist includes staging auth surface");
assertPattern(releaseChecklist, /smoke:staging-storage-summary/i, "release checklist includes staging storage summary");
assertPattern(releaseChecklist, /HWALLET_SESSION_STORE=postgres/i, "release checklist includes postgres staging gate");
assertPattern(stagingDeployment, /HWALLET_SESSION_STORE=postgres/i, "staging deployment documents postgres mode");
assertPattern(stagingDeployment, /smoke:staging-storage-summary/i, "staging deployment documents storage summary smoke");
checks.push("release and staging docs keep auth/storage gates visible");

assertNoRawSecrets({
  "docs/STORAGE_MIGRATION.md": storageMigration,
  "docs/HWALLET_DATABASE_DESIGN.md": databaseDesign,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/STAGING_SERVER_DEPLOYMENT.md": stagingDeployment,
  "v2/scripts/smoke-hwallet-dual-observation-live.mjs": dualObservationSmoke,
  "v2/scripts/smoke-hwallet-dual-consistency-live.mjs": dualConsistencySmoke,
  "v2/scripts/smoke-hwallet-postgres-api-live.mjs": postgresApiSmoke,
  "v2/scripts/smoke-hwallet-postgres-performance-live.mjs": postgresPerformanceSmoke
});
checks.push("cutover docs avoid raw secret material");

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
  if (!condition) throw new Error(`Supabase cutover safety smoke failed: ${label}`);
}
