import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const checks = [];
const storeConsoleEvidencePath =
  process.env.HWALLET_STORE_CONSOLE_EVIDENCE_FILE ||
  ".tmp/hwallet-store-console-evidence.json";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const ledger = await readFile("docs/HWALLET_RELEASE_TASK_LEDGER.md", "utf8");
const workQueue = await readFile("docs/HWALLET_WORK_QUEUE.md", "utf8");
const ownerPacket = await readFile("docs/HWALLET_OWNER_RELEASE_PACKET.md", "utf8");
const releaseCandidateSmoke = await readFile("v2/scripts/smoke-hwallet-release-candidate.mjs", "utf8");
const scripts = packageJson.scripts || {};

assertNoRawSecrets(ledger, "docs/HWALLET_RELEASE_TASK_LEDGER.md");
assertNoRawSecrets(workQueue, "docs/HWALLET_WORK_QUEUE.md");
assertNoRawSecrets(ownerPacket, "docs/HWALLET_OWNER_RELEASE_PACKET.md");

assert(typeof scripts["smoke:release-next-action"] === "string", "package exposes release next-action smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:release-next-action"),
  "verify:merge includes release next-action smoke"
);
assertIncludes(releaseCandidateSmoke, "smoke:release-next-action", "release candidate gate includes next-action smoke");

const tasks = parseTasks(ledger);
for (const id of ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006"]) {
  assert(tasks[id]?.status === "Merged", `${id} is already merged`);
}
const ownerActionStatuses = {
  "R-007": [
    "Blocked waiting for owner",
    "In Apple processing / TestFlight console handoff"
  ],
  "R-008": ["Blocked waiting for owner"],
  "R-009": ["Blocked waiting for owner"]
};

for (const [id, allowedStatuses] of Object.entries(ownerActionStatuses)) {
  assert(allowedStatuses.includes(tasks[id]?.status), `${id} is owner/store-console gated`);
}

assertIncludes(ledger, "No fully automatable task remains", "ledger declares no automatable release task remains");
assertIncludes(ledger, "owner/store-console evidence", "ledger points next action at store-console evidence");
assertIncludes(workQueue, "Continue without owner input", "work queue defines safe autonomous continuation");
assertIncludes(ownerPacket, "No secret material is needed now", "owner packet keeps next ask non-secret");
assertIncludes(ownerPacket, "Confirm the Apple/TestFlight build status", "owner packet asks for Apple/TestFlight confirmation");
assertIncludes(ownerPacket, "Confirm the Google Play internal testing build status", "owner packet asks for Google Play confirmation");
assertIncludes(ownerPacket, "Approve final store copy and screenshots", "owner packet asks for store metadata approval");

const localStoreEvidence = await inspectStoreConsoleEvidence(storeConsoleEvidencePath);
checks.push("store-console evidence status is summarized without secrets");

const nextAction = localStoreEvidence.strictReady
  ? {
      kind: "strict_release_handoff",
      reason: "owner console evidence is ready",
      command:
        "HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff"
    }
  : {
      kind: "owner_evidence",
      reason: "store-console evidence is not strict-ready yet",
      taskIds: ["R-007", "R-008", "R-009"],
      ask: [
        "Apple/TestFlight ready status",
        "Google Play internal testing ready status",
        "final store copy and screenshot approval"
      ],
      statusCommand: "npm run smoke:hwallet-store-console-evidence"
    };

console.log(JSON.stringify({
  ok: true,
  checks,
  release: {
    product: "HWallet wallet entry plus Agent experience",
    apiBaseUrl: "https://app.hwallet.vip",
    liveExecutionClosed: true,
    automatableReleaseTasksRemaining: 0,
    ownerGatedTaskIds: ["R-007", "R-008", "R-009"],
    mergedTaskIds: ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006"]
  },
  localStoreEvidence,
  nextAction
}, null, 2));

function parseTasks(text) {
  const tasks = {};
  const pattern = /^### (R-\d{3}) ([^\n]+)\n([\s\S]*?)(?=\n### R-\d{3} |\n##(?!#) |(?![\s\S]))/gm;
  for (const match of text.matchAll(pattern)) {
    const [, id, title, body] = match;
    const status = body.match(/- \*\*Status\*\*: ([^.]+)\./)?.[1] || "Unknown";
    tasks[id] = { id, title, status };
  }
  return tasks;
}

async function inspectStoreConsoleEvidence(path) {
  try {
    await access(path);
  } catch {
    return {
      status: "missing",
      path,
      strictReady: false,
      missingForStrict: ["store-console evidence file"]
    };
  }

  if (!isGitIgnored(path)) {
    return {
      status: "invalid",
      path,
      strictReady: false,
      reason: "evidence file is not git ignored"
    };
  }

  try {
    const raw = await readFile(path, "utf8");
    assertNoRawSecrets(raw, path);
    const evidence = JSON.parse(raw);
    if (evidence.kind !== "hwallet-store-console-evidence" || evidence.version !== 1) {
      return {
        status: "invalid",
        path,
        strictReady: false,
        reason: "unexpected evidence shape"
      };
    }

    const missingForStrict = missingStrictFields(evidence);
    return {
      status: "present",
      path,
      appVersion: evidence.environment?.appVersion || null,
      apiBaseUrl: evidence.environment?.apiBaseUrl || null,
      releaseTrack: evidence.environment?.releaseTrack || null,
      iosStatus: evidence.ios?.status || "missing",
      androidStatus: evidence.android?.status || "missing",
      artifacts: Array.isArray(evidence.artifacts) ? evidence.artifacts.length : 0,
      strictReady: missingForStrict.length === 0,
      missingForStrict
    };
  } catch (error) {
    return {
      status: "invalid",
      path,
      strictReady: false,
      reason: redactError(error)
    };
  }
}

function missingStrictFields(evidence) {
  const missing = [];
  const ios = evidence.ios || {};
  const android = evidence.android || {};

  if (!hasText(evidence.operator?.label) || looksUnresolved(evidence.operator?.label)) {
    missing.push("operator label");
  }
  if (ios.status !== "ready") missing.push("iOS ready status");
  if (android.status !== "ready") missing.push("Android ready status");
  if (!isUuid(ios.buildId) || isExampleBuildId(ios.buildId)) missing.push("iOS real build id");
  if (!isUuid(android.buildId) || isExampleBuildId(android.buildId)) missing.push("Android real build id");
  if (!hasText(ios.appRecordLabel) || looksUnresolved(ios.appRecordLabel)) missing.push("iOS app record label");
  if (!hasText(android.appRecordLabel) || looksUnresolved(android.appRecordLabel)) missing.push("Android app record label");
  for (const [key, value] of Object.entries(ios.testflight || {})) {
    if (value !== true) missing.push(`iOS TestFlight ${key}`);
  }
  for (const [key, value] of Object.entries(ios.metadata || {})) {
    if (value !== true) missing.push(`iOS metadata ${key}`);
  }
  for (const [key, value] of Object.entries(android.internalTesting || {})) {
    if (value !== true) missing.push(`Android internal testing ${key}`);
  }
  for (const [key, value] of Object.entries(android.metadata || {})) {
    if (value !== true) missing.push(`Android metadata ${key}`);
  }
  for (const [key, value] of Object.entries(evidence.checks || {})) {
    if (value !== true) missing.push(`check ${key}`);
  }
  for (const [key, value] of Object.entries(evidence.confirmations || {})) {
    if (value !== true) missing.push(`confirmation ${key}`);
  }
  if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length < 2) {
    missing.push("redacted console artifacts");
  }

  return missing.slice(0, 12);
}

function assertIncludes(text, value, label) {
  assert(text.includes(value), label);
}

function isGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });
  return ignoreCheck.status === 0;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function looksUnresolved(value) {
  return /(?:fill|todo|tbd|placeholder|replace)/i.test(String(value || ""));
}

function isExampleBuildId(value) {
  return (
    /00000000-0000-4000-8000-000000000000/i.test(String(value || "")) ||
    /11111111-1111-4111-8111-111111111111/i.test(String(value || ""))
  );
}

function assertNoRawSecrets(text, file) {
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

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`Release next-action smoke failed: ${file} must not contain raw secret material`);
    }
  }
}

function redactError(error) {
  return String(error?.message || error || "unknown error")
    .replace(/0x[a-fA-F0-9]{8,}/g, "0x...")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
}

function assert(condition, label) {
  if (!condition) throw new Error(`Release next-action smoke failed: ${label}`);
  checks.push(label);
}
