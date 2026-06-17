import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const workflowDoc = await readFile("docs/TASK_REVIEW_WORKFLOW.md", "utf8");
const workQueueDoc = await readFile("docs/HWALLET_WORK_QUEUE.md", "utf8");
const dispatchMatrix = await readFile("docs/HWALLET_SUBTASK_DISPATCH_MATRIX.md", "utf8");
const prTemplate = await readFile(".github/pull_request_template.md", "utf8");
const issueTemplate = await readFile(".github/ISSUE_TEMPLATE/hwallet_task.yml", "utf8");

const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:subtask-dispatch"] === "string", "package exposes subtask dispatch smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:subtask-dispatch"),
  "verify:merge includes subtask dispatch smoke"
);

assertIncludes(workflowDoc, "HWALLET_SUBTASK_DISPATCH_MATRIX.md", "task workflow links dispatch matrix");
assertIncludes(workQueueDoc, "HWALLET_SUBTASK_DISPATCH_MATRIX.md", "work queue links dispatch matrix");

for (const section of [
  "Controller Rule",
  "Dispatch Packet",
  "Helper Types",
  "Return Packet",
  "Hard Blocks",
  "Current Release Use"
]) {
  assertIncludes(dispatchMatrix, `## ${section}`, `dispatch matrix includes ${section}`);
}

for (const field of [
  "Task id",
  "Lane",
  "Question",
  "Allowed files",
  "Allowed commands",
  "Stop condition",
  "Return format"
]) {
  assertIncludes(dispatchMatrix, `**${field}**`, `dispatch packet requires ${field}`);
}

for (const helperType of [
  "Research scout",
  "Implementation draft",
  "Review agent",
  "Release evidence clerk"
]) {
  assertIncludes(dispatchMatrix, helperType, `dispatch matrix defines ${helperType}`);
}

assertIncludes(dispatchMatrix, "Only the controller may stage files", "controller keeps staging authority");
assertIncludes(dispatchMatrix, "create commits", "controller keeps commit authority");
assertIncludes(dispatchMatrix, "open PRs", "controller keeps PR authority");
assertIncludes(dispatchMatrix, "merge PRs", "controller keeps merge authority");
assertIncludes(dispatchMatrix, "at most three active helper packets", "dispatch caps helper parallelism");
assertIncludes(dispatchMatrix, "Do not run two helper packets", "dispatch prevents overlapping risky helpers");
assertIncludes(dispatchMatrix, "only inside controller branch and allowed files", "implementation draft is scoped");
assertIncludes(dispatchMatrix, "The controller must rerun the relevant smoke", "controller revalidates helper output");
assertIncludes(dispatchMatrix, "approve, return for fixes, split, or block waiting for owner", "return packet supports review decisions");
assertIncludes(dispatchMatrix, "npm run smoke:release-next-action", "dispatch respects owner-gated release state");
assertIncludes(dispatchMatrix, "They may continue only with", "dispatch blocks fake progress around owner gates");
assertIncludes(dispatchMatrix, "local scaffolding", "dispatch limits owner-gated continuation to local work");

for (const forbiddenScope of [
  "private keys",
  "seed phrases",
  "Apple credentials",
  "Google Play",
  "Privy access tokens",
  "Supabase connection strings",
  "OKX keys",
  "verification codes",
  "raw emails",
  "live trading",
  "swapping",
  "signing",
  "order placement",
  "Commit `.tmp` evidence"
]) {
  assertIncludes(dispatchMatrix, forbiddenScope, `dispatch blocks ${forbiddenScope}`);
}
assertIncludes(dispatchMatrix, "unredacted wallet", "dispatch blocks unredacted wallet data");
assertIncludes(dispatchMatrix, "addresses", "dispatch blocks wallet address exposure");
assertIncludes(dispatchMatrix, "money", "dispatch blocks money movement wording");
assertIncludes(dispatchMatrix, "movement", "dispatch blocks autonomous money movement");

assertIncludes(prTemplate, "Review Decision", "PR template still records review decision");
assertIncludes(prTemplate, "Needs changes", "PR template can return fixes");
assertIncludes(issueTemplate, "Owner evidence required", "issue template still separates owner evidence");

assertNoRawSecrets({
  "docs/TASK_REVIEW_WORKFLOW.md": workflowDoc,
  "docs/HWALLET_WORK_QUEUE.md": workQueueDoc,
  "docs/HWALLET_SUBTASK_DISPATCH_MATRIX.md": dispatchMatrix,
  ".github/pull_request_template.md": prTemplate,
  ".github/ISSUE_TEMPLATE/hwallet_task.yml": issueTemplate
});
checks.push("subtask dispatch docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  dispatch: {
    maxHelperPacketsPerCycle: 3,
    controllerOnlyMerge: true,
    liveExecutionClosed: true,
    ownerGateRespected: true
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
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /0x[a-fA-F0-9]{40}/,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Subtask dispatch smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Subtask dispatch smoke failed: ${label}`);
  checks.push(label);
}
