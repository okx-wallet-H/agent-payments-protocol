import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const packet = await readFile("docs/HWALLET_OWNER_RELEASE_PACKET.md", "utf8");
const ledger = await readFile("docs/HWALLET_RELEASE_TASK_LEDGER.md", "utf8");
const workQueue = await readFile("docs/HWALLET_WORK_QUEUE.md", "utf8");
const distributionPlan = await readFile("docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");

const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:release-owner-packet"] === "string", "package exposes owner release packet smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:release-owner-packet"),
  "verify:merge includes owner release packet smoke"
);

for (const section of [
  "Current Release State",
  "Current Known External Gates",
  "What The Owner May Need To Provide",
  "R-007 iOS TestFlight",
  "R-008 Android Internal Testing",
  "R-009 Store Metadata",
  "Commands The Controller Runs",
  "Stop And Continue Rules",
  "Redaction Rules",
  "Current Next Owner Ask"
]) {
  assertHeading(packet, section, `owner packet includes ${section}`);
}

for (const required of [
  "HWallet wallet entry plus Agent experience",
  "https://app.hwallet.vip",
  "live signing, live swaps, prediction orders",
  "autonomous money movement stay closed",
  "R-007 iOS TestFlight",
  "R-008 Android",
  "internal testing candidate build",
  "R-009 store metadata"
]) {
  assertIncludes(packet, required, `owner packet records release state: ${required}`);
}

for (const blocker of [
  "submitted to App Store Connect",
  "Apple-side processing",
  "TestFlight internal-testing availability",
  "Android production build `6c66eb31-ea1b-40f2-b23d-bfb3ee2fa547` completed",
  "Google Play Console upload",
  "internal-testing readiness",
  "external-state gates"
]) {
  assertIncludes(packet, blocker, `owner packet records external gate: ${blocker}`);
}

for (const forbiddenBoundary of [
  "passwords",
  "private keys",
  "seed phrases",
  "Apple credentials",
  "Google Play service-account JSON",
  "Privy access tokens",
  "Supabase connection strings",
  "OKX keys",
  "verification codes",
  "unredacted personal data"
]) {
  assertIncludes(packet, forbiddenBoundary, `owner packet blocks ${forbiddenBoundary}`);
}

for (const command of [
  "npm run smoke:owner-release-status",
  "npm run hwallet:store-console-evidence:init",
  "npm run hwallet:store-console-evidence:record",
  "HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence",
  "HWALLET_RELEASE_HANDOFF_STRICT=true",
  "npm run smoke:mobile-release-handoff",
  "npm run verify:merge"
]) {
  assertIncludes(packet, command, `owner packet documents command: ${command}`);
}

for (const evidencePath of [
  ".tmp/hwallet-store-console-evidence.json",
  ".tmp/hwallet-mobile-store-build-evidence.json",
  ".tmp/hwallet-device-evidence-ios.json",
  ".tmp/hwallet-device-evidence-android.json"
]) {
  assertIncludes(packet, evidencePath, `owner packet names ignored evidence path ${evidencePath}`);
}

assertIncludes(packet, "Continue without owner input", "owner packet defines continue rule");
assertIncludes(packet, "Stop and ask the owner", "owner packet defines stop rule");
assertIncludes(packet, "real Apple / Google dashboard action", "owner packet stops on store dashboard actions");
assertIncludes(packet, "device install", "owner packet stops on device install");
assertIncludes(packet, "screenshot approval", "owner packet stops on screenshot approval");
assertIncludes(packet, "Store evidence in ignored `.tmp` files only", "owner packet keeps evidence ignored");
assertIncludes(packet, "No secret material is needed now", "owner packet keeps current ask non-secret");

assertIncludes(ledger, "R-007, R-008, and R-009 are intentionally owner-gated", "ledger keeps owner-gated release tasks");
assertIncludes(ledger, "owner/store-console evidence", "ledger names owner evidence next");
assertIncludes(ledger, "Apple-side build processing", "ledger records iOS owner-side processing gate");
assertIncludes(ledger, "TestFlight internal", "ledger records iOS TestFlight gate");
assertIncludes(ledger, "Google Play Console/internal testing action", "ledger records Android owner-side console gate");
assertIncludes(
  ledger,
  "Android production build `6c66eb31-ea1b-40f2-b23d-bfb3ee2fa547` completed",
  "ledger records completed Android production build"
);
assertIncludes(workQueue, "Stop Conditions", "work queue has owner stop conditions");
assertIncludes(workQueue, "Continue without owner input", "work queue has continue rules");
assertIncludes(distributionPlan, "Store console evidence", "distribution plan keeps store console evidence gate");
assertIncludes(releaseChecklist, "npm run smoke:hwallet-store-console-evidence", "release checklist keeps store console smoke");

assertNoRawSecrets({
  "docs/HWALLET_OWNER_RELEASE_PACKET.md": packet,
  "docs/HWALLET_RELEASE_TASK_LEDGER.md": ledger,
  "docs/HWALLET_WORK_QUEUE.md": workQueue,
  "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md": distributionPlan,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist
});
checks.push("owner release packet docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  ownerPacket: {
    releaseState: "owner-gated",
    tasks: ["R-007", "R-008", "R-009"],
    needsSecretMaterial: false,
    evidencePath: ".tmp/hwallet-store-console-evidence.json",
    liveExecutionClosed: true
  }
}, null, 2));

function assertIncludes(text, value, label) {
  assert(text.includes(value), label);
}

function assertHeading(text, value, label) {
  assert(new RegExp(`^#{2,3} ${escapeRegExp(value)}$`, "m").test(text), label);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNoRawSecrets(files) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /APPLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Owner release packet smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Owner release packet smoke failed: ${label}`);
  checks.push(label);
}
