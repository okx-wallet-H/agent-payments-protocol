import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const storageMigration = await readFile("docs/STORAGE_MIGRATION.md", "utf8");
const stagingDeployment = await readFile("docs/STAGING_SERVER_DEPLOYMENT.md", "utf8");
const cutoverSafetyGate = sectionFrom(storageMigration, "## Cutover Safety Gate");

const scripts = packageJson.scripts || {};
const checks = [];

const rollbackCommands = [
  "HWALLET_SESSION_STORE=dual",
  "HWALLET_SESSION_STORE=jsonl"
];

const requiredValidationScripts = [
  "smoke:hwallet-dual-observation:live",
  "smoke:hwallet-dual-consistency:live",
  "smoke:hwallet-postgres-api:live",
  "smoke:hwallet-postgres-performance:live",
  "smoke:audit-timeline:live",
  "smoke:phase-one-records:live",
  "smoke:agent-action-store:live",
  "smoke:market-snapshots:live"
];

for (const scriptName of requiredValidationScripts) {
  assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
}
checks.push("package exposes live validation scripts needed before and after rollback");

for (const command of rollbackCommands) {
  assertIncludes(storageMigration, command, `storage migration documents ${command}`);
}
checks.push("storage migration documents dual and jsonl rollback modes");

assertPattern(storageMigration, /\bpg_dump\b|managed Supabase backup/i, "storage migration documents a backup before cutover");
assertPattern(storageMigration, /private-backups/i, "storage migration keeps backup output outside normal source files");
assertPattern(storageMigration, /must stay outside Git/i, "storage migration keeps backups outside Git");
checks.push("storage migration documents backup location and Git exclusion");

assertPattern(
  storageMigration,
  /Never paste the real `DATABASE_URL`|without exposing any secrets|不暴露/i,
  "storage migration documents secret hygiene"
);
assertNoRawSecrets({
  "docs/STORAGE_MIGRATION.md": storageMigration,
  "docs/STAGING_SERVER_DEPLOYMENT.md": stagingDeployment
});
checks.push("rollback docs do not expose raw secret material");

assertOrder(cutoverSafetyGate, "HWALLET_SESSION_STORE=dual npm run dev", "HWALLET_SESSION_STORE=postgres npm run dev", "dual comes before postgres");
assertOrder(cutoverSafetyGate, "pg_dump", "HWALLET_SESSION_STORE=postgres npm run dev", "backup comes before postgres read path");
checks.push("cutover order keeps dual observation and backup before postgres mode");

assertPattern(
  storageMigration,
  /Roll back immediately if login, wallet binding, recharge, tx verification,\s*Agent memory, audit, or record readback fails/i,
  "rollback trigger covers critical HWallet flows"
);
assertPattern(storageMigration, /preserve the failing request id \/\s*audit id/i, "rollback preserves failure evidence");
assertPattern(storageMigration, /compare the affected user rows against the JSONL fallback/i, "rollback compares affected user rows");
assertPattern(storageMigration, /keep real execution disabled/i, "rollback keeps real execution disabled");
checks.push("rollback trigger, evidence preservation, comparison, and execution safety are documented");

assertPattern(stagingDeployment, /HWALLET_SESSION_STORE=postgres/i, "staging deployment documents postgres target");
assertPattern(stagingDeployment, /AGENT_REQUIRE_PRIVY_TOKEN=true/i, "staging deployment keeps Privy token gate");
assertPattern(stagingDeployment, /AGENT_REQUIRE_OWNER=true/i, "staging deployment keeps owner gate");
assertPattern(stagingDeployment, /AGENT_WALLET_REAL_EXECUTION=false/i, "staging deployment keeps real execution closed");
checks.push("staging deployment keeps postgres target behind auth and no-live-execution gates");

console.log(JSON.stringify({
  ok: true,
  checks
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

function sectionFrom(text, heading) {
  const start = text.indexOf(heading);
  assert(start !== -1, `${heading} section exists`);
  const next = text.indexOf("\n## ", start + heading.length);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Supabase rollback plan smoke failed: ${label}`);
}
