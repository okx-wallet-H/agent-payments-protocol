import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const ledger = await readFile("docs/HWALLET_RELEASE_TASK_LEDGER.md", "utf8");
const workQueue = await readFile("docs/HWALLET_WORK_QUEUE.md", "utf8");
const workflow = await readFile("docs/TASK_REVIEW_WORKFLOW.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");

const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:release-task-ledger"] === "string", "package exposes release task ledger smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:release-task-ledger"),
  "verify:merge includes release task ledger smoke"
);

for (const section of [
  "Controller Selection Rule",
  "Status Definitions",
  "Lane 1 - HWallet Wallet Flow Stability",
  "Lane 2 - Supabase Production Data Layer",
  "Lane 3 - Agent Orchestration",
  "Lane 4 - OKX Onchain Skill And Plugin Integration",
  "Lane 5 - Mobile Release",
  "Current Next Best Tasks",
  "Required Release Gates"
]) {
  assertIncludes(ledger, section, `ledger includes ${section}`);
}

for (const state of [
  "Ready",
  "Claimed",
  "In progress",
  "Review",
  "Returned for fixes",
  "Blocked waiting for owner",
  "Merged"
]) {
  assertIncludes(ledger, state, `ledger defines ${state}`);
}

const requiredTasks = {
  "R-001": "Installed App two-user wallet regression",
  "R-002": "Deposit recognition without mandatory hash paste",
  "R-003": "Supabase postgres cutover candidate",
  "R-004": "Staging API auth and storage handoff",
  "R-005": "Agent wallet context and friendly replies",
  "R-006": "Read-only OKX capability adapter",
  "R-007": "iOS TestFlight candidate build",
  "R-008": "Android internal testing candidate build",
  "R-009": "Store metadata final owner pass"
};

for (const [id, title] of Object.entries(requiredTasks)) {
  assertIncludes(ledger, `### ${id} ${title}`, `ledger defines ${id}`);
  assertTaskHasFields(ledger, id, [
    "Status",
    "Owner evidence",
    "Goal",
    "In scope",
    "Out of scope",
    "Validation",
    "Done evidence",
    "Rollback"
  ]);
}

assertTaskStatus(ledger, "R-001", "Merged");
assertTaskStatus(ledger, "R-002", "Merged");
assertTaskStatus(ledger, "R-003", "Merged");
assertTaskStatus(ledger, "R-004", "Merged");
assertTaskStatus(ledger, "R-005", "Merged");
assertTaskStatus(ledger, "R-006", "Merged");

for (const command of [
  "npm run smoke:mobile-hwallet-ux",
  "npm run smoke:wallet-sync",
  "npm run smoke:supabase-cutover-safety",
  "npm run smoke:staging-server",
  "npm run smoke:agent-orchestrator",
  "npm run smoke:agent-mcp-tool-adapter",
  "npm --prefix apps/mobile run build:ios",
  "npm --prefix apps/mobile run build:android",
  "npm run smoke:mobile-store-submission",
  "npm run smoke:hwallet-store-console-evidence",
  "npm run smoke:release-owner-packet",
  "npm run smoke:release-next-action",
  "npm run smoke:task-review-workflow",
  "npm run smoke:hwallet-release-candidate",
  "npm run smoke:mobile-store-readiness",
  "git diff --check"
]) {
  assertIncludes(ledger, command, `ledger includes validation command: ${command}`);
}

assertIncludes(ledger, "live trading, signing, swapping, or autonomous money movement", "ledger keeps live execution closed");
assertIncludes(ledger, "R-007, R-008, and R-009 are intentionally owner-gated", "ledger separates owner-gated release tasks");
assertIncludes(ledger, "redacted", "ledger requires redacted evidence");
assertIncludes(ledger, ".tmp", "ledger keeps local evidence in ignored temp files");
assertIncludes(ledger, "raw access tokens", "ledger blocks token leakage");
assertIncludes(ledger, "https://app.hwallet.vip", "ledger uses current staging API");

assertIncludes(ledger, "No fully automatable task remains", "ledger declares no fully automatable task remains");
assertIncludes(ledger, "iOS and Android installed-App evidence", "ledger records dual-platform device evidence");
assertIncludes(ledger, "owner/store-console evidence", "ledger names store-console evidence as the next owner action");

assertIncludes(workQueue, "HWallet 7x24 Work Queue", "work queue exists");
assertIncludes(workflow, "HWallet Task Review Workflow", "task review workflow exists");
assertIncludes(releaseChecklist, "Mobile store readiness gate", "release checklist keeps mobile release gates");
assertIncludes(releaseChecklist, "HWallet release candidate gate", "release checklist keeps release candidate gate");

assertNoRawSecrets({
  "docs/HWALLET_RELEASE_TASK_LEDGER.md": ledger,
  "docs/HWALLET_WORK_QUEUE.md": workQueue,
  "docs/TASK_REVIEW_WORKFLOW.md": workflow
});
checks.push("release task ledger docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  ledger: {
    readyAutomatableTasks: [],
    mergedTasks: ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006"],
    ownerGatedTasks: ["R-007", "R-008", "R-009"],
    liveExecutionClosed: true
  }
}, null, 2));

function assertTaskHasFields(text, taskId, fields) {
  const taskPattern = new RegExp(`### ${taskId} [\\s\\S]*?(?=\\n### R-|\\n## |$)`);
  const match = text.match(taskPattern);
  assert(Boolean(match), `ledger can isolate ${taskId}`);
  const block = match[0];
  for (const field of fields) {
    assertIncludes(block, `**${field}**`, `${taskId} includes ${field}`);
  }
}

function assertTaskStatus(text, taskId, expectedStatus) {
  const taskPattern = new RegExp(`### ${taskId} [\\s\\S]*?(?=\\n### R-|\\n## |$)`);
  const match = text.match(taskPattern);
  assert(Boolean(match), `ledger can isolate ${taskId} status`);
  assertIncludes(match[0], `**Status**: ${expectedStatus}.`, `${taskId} status is ${expectedStatus}`);
}

function assertIncludes(text, value, label) {
  assert(text.includes(value), label);
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
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Release task ledger smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Release task ledger smoke failed: ${label}`);
  checks.push(label);
}
