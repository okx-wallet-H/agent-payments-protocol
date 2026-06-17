import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const workflowDoc = await readFile("docs/TASK_REVIEW_WORKFLOW.md", "utf8");
const workQueueDoc = await readFile("docs/HWALLET_WORK_QUEUE.md", "utf8");
const issueTemplate = await readFile(".github/ISSUE_TEMPLATE/hwallet_task.yml", "utf8");
const issueConfig = await readFile(".github/ISSUE_TEMPLATE/config.yml", "utf8");
const prTemplate = await readFile(".github/pull_request_template.md", "utf8");
const reviewGate = await readFile(".github/workflows/hwallet-review-gate.yml", "utf8");

const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:task-review-workflow"] === "string", "package exposes task review workflow smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:task-review-workflow"),
  "verify:merge includes task review workflow smoke"
);

for (const lane of [
  "HWallet wallet flow",
  "Supabase data layer",
  "Agent orchestration",
  "OKX Onchain Skill",
  "Mobile release",
  "Docs / workflow"
]) {
  assertIncludes(workflowDoc, lane, `workflow doc covers ${lane}`);
  assertIncludes(issueTemplate, lane, `issue template exposes ${lane}`);
}

for (const state of [
  "Ready",
  "In progress",
  "Review",
  "Returned for fixes",
  "Blocked waiting for owner",
  "Merged"
]) {
  assertIncludes(workflowDoc, state, `workflow doc defines ${state} state`);
}

assertIncludes(workflowDoc, "three implementation branches", "workflow caps active implementation branches");
assertIncludes(workflowDoc, "owner evidence", "workflow records owner evidence boundary");
assertIncludes(workflowDoc, "real trading, swapping, signing, and money movement disabled", "workflow keeps live money movement closed");
assertIncludes(workflowDoc, "npm run smoke:task-review-workflow", "workflow self-review runs workflow smoke");
assertIncludes(workflowDoc, "HWallet Merge Gate", "workflow requires merge gate");

assertIncludes(workQueueDoc, "7x24", "work queue documents autonomous cadence");
assertIncludes(workQueueDoc, "Controller Loop", "work queue documents controller loop");
assertIncludes(workQueueDoc, "Priority Order", "work queue documents priority order");
assertIncludes(workQueueDoc, "Parallelism Rule", "work queue documents parallelism rule");
assertIncludes(workQueueDoc, "Task Packet", "work queue documents task packet");
assertIncludes(workQueueDoc, "Evidence Rules", "work queue documents evidence rules");
assertIncludes(workQueueDoc, "Stop Conditions", "work queue documents owner stop conditions");
assertIncludes(workQueueDoc, "Live execution closed", "work queue keeps live execution closed");
assertIncludes(workQueueDoc, "Do not commit `.tmp` evidence files", "work queue keeps local evidence out of git");

for (const field of [
  "Work lane",
  "Goal",
  "In scope",
  "Out of scope",
  "Acceptance checks",
  "Validation plan",
  "Owner evidence required",
  "Safety gate"
]) {
  assertIncludes(issueTemplate, field, `issue template requires ${field}`);
}

assertIncludes(issueTemplate, "No - fully automatable", "issue template can mark fully automatable tasks");
assertIncludes(issueTemplate, "Yes - owner/device/dashboard evidence required", "issue template can mark owner evidence tasks");
assertIncludes(issueConfig, "HWallet task workflow", "issue config points to workflow doc");
assertIncludes(prTemplate, "Linked Task", "PR template links task");
assertIncludes(prTemplate, "What Stayed Out Of Scope", "PR template preserves scope");
assertIncludes(prTemplate, "Validation", "PR template requires validation");
assertIncludes(prTemplate, "Owner Evidence", "PR template records owner evidence status");
assertIncludes(prTemplate, "Blocked waiting for owner evidence", "PR template can block on owner evidence");
assertIncludes(prTemplate, "Safety", "PR template requires safety review");
assertIncludes(prTemplate, "Review Decision", "PR template records review decision");
assertIncludes(prTemplate, "Rollback", "PR template requires rollback");

assertIncludes(reviewGate, "git diff --check", "GitHub gate checks whitespace");
assertIncludes(reviewGate, "npm run typecheck", "GitHub gate typechecks root");
assertIncludes(reviewGate, "npm run mobile:typecheck", "GitHub gate typechecks mobile");
assertIncludes(reviewGate, "npm run smoke:task-review-workflow", "GitHub gate runs task workflow smoke");
assertIncludes(reviewGate, "npm run smoke:hwallet-release-candidate", "GitHub gate runs release candidate smoke");
assertIncludes(reviewGate, "npm run dev", "GitHub gate starts local Next server");
assertIncludes(reviewGate, "npm run verify:merge", "GitHub gate runs full merge verification");

assertNoRawSecrets({
  "docs/TASK_REVIEW_WORKFLOW.md": workflowDoc,
  "docs/HWALLET_WORK_QUEUE.md": workQueueDoc,
  ".github/ISSUE_TEMPLATE/hwallet_task.yml": issueTemplate,
  ".github/pull_request_template.md": prTemplate,
  ".github/workflows/hwallet-review-gate.yml": reviewGate
});
checks.push("task workflow docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  workflow: {
    maxImplementationBranches: 3,
    liveExecutionClosed: true,
    ownerStopConditions: true
  }
}, null, 2));

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
        throw new Error(`Task review workflow smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Task review workflow smoke failed: ${label}`);
  checks.push(label);
}
