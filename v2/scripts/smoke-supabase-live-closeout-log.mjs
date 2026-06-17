import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const closeout = await readFile("docs/HWALLET_SUPABASE_LIVE_CLOSEOUT.md", "utf8");
const databaseDesign = await readFile("docs/HWALLET_DATABASE_DESIGN.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");

const scripts = packageJson.scripts || {};
const checks = [];

const requiredScripts = [
  "smoke:supabase-live-closeout-log",
  "smoke:supabase-closeout",
  "smoke:supabase-cutover-safety",
  "smoke:supabase-readback-drill",
  "smoke:supabase-rollback-plan",
  "smoke:hwallet-dual-observation:live",
  "smoke:hwallet-dual-consistency:live",
  "smoke:hwallet-postgres-api:live",
  "smoke:hwallet-postgres-performance:live"
];

for (const scriptName of requiredScripts) {
  assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
}
assert(
  String(scripts["verify:merge"] || "").includes("smoke:supabase-live-closeout-log"),
  "verify:merge includes the Supabase live closeout log gate"
);
checks.push("package exposes the live closeout log gate");

assertIncludes(closeout, "Date: 2026-06-17", "closeout records the validation date");
assertIncludes(closeout, "Storage modes validated: `dual` and `postgres`", "closeout records dual and postgres modes");
assertIncludes(closeout, "HWALLET_SESSION_STORE=dual npm run dev", "closeout records the dual server mode");
assertIncludes(closeout, "smoke:hwallet-dual-observation:live", "closeout records dual observation");
assertIncludes(closeout, "smoke:hwallet-dual-consistency:live", "closeout records dual consistency");
assertIncludes(closeout, "HWALLET_SESSION_STORE=postgres npm run dev", "closeout records postgres server mode");
assertIncludes(closeout, "smoke:hwallet-postgres-api:live", "closeout records postgres API readback");
assertIncludes(closeout, "smoke:hwallet-postgres-performance:live", "closeout records postgres performance");
checks.push("closeout records the live validation commands");

assertIncludes(closeout, "Other-user isolation passed in both `dual` and `postgres` validation.", "closeout records user isolation");
assertIncludes(closeout, "money_moved=false", "closeout records no-money audit protection");
assertIncludes(closeout, "Supabase pool settings stayed inside the App's safe bounds", "closeout records pool safety");
assertIncludes(closeout, "Keep `HWALLET_SESSION_STORE=dual` or `jsonl` as the rollback path", "closeout records rollback path");
assertPattern(closeout, /live execution.*closed/i, "closeout keeps live execution closed");
checks.push("closeout records isolation, audit, performance, rollback, and execution boundaries");

assertIncludes(databaseDesign, "HWallet Supabase live closeout", "database design links to the live closeout");
assertIncludes(releaseChecklist, "HWallet Supabase live closeout", "release checklist links to the live closeout");
checks.push("database and release docs link to the live closeout");

assertNoRawSecrets({
  "docs/HWALLET_SUPABASE_LIVE_CLOSEOUT.md": closeout,
  "docs/HWALLET_DATABASE_DESIGN.md": databaseDesign,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist
});
checks.push("live closeout docs avoid raw secret material");

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

function assertNoRawSecrets(files) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /DATABASE_URL\s*=\s*["']?(?!postgresql:\/\/\.\.\.|postgresql:\/\/postgres:<password>)[^\s"']+/i,
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Supabase live closeout log smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Supabase live closeout log smoke failed: ${label}`);
  checks.push(label);
}
