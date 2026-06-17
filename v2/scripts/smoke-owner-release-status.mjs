import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const checks = [];
const storeConsoleEvidencePath =
  process.env.HWALLET_STORE_CONSOLE_EVIDENCE_FILE ||
  ".tmp/hwallet-store-console-evidence.json";
const iosDeviceEvidencePath =
  process.env.HWALLET_IOS_DEVICE_EVIDENCE_FILE ||
  ".tmp/hwallet-device-evidence-ios.json";
const androidDeviceEvidencePath =
  process.env.HWALLET_ANDROID_DEVICE_EVIDENCE_FILE ||
  ".tmp/hwallet-device-evidence-android.json";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const ownerPacket = await readFile("docs/HWALLET_OWNER_RELEASE_PACKET.md", "utf8");
const workQueue = await readFile("docs/HWALLET_WORK_QUEUE.md", "utf8");
const taskLedger = await readFile("docs/HWALLET_RELEASE_TASK_LEDGER.md", "utf8");
const screenshotPlan = await readFile("docs/HWALLET_STORE_SCREENSHOT_PLAN.md", "utf8");
const releaseCandidateSmoke = await readFile("v2/scripts/smoke-hwallet-release-candidate.mjs", "utf8");
const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:owner-release-status"] === "string", "package exposes owner release status smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:owner-release-status"),
  "verify:merge includes owner release status smoke"
);
assert(
  releaseCandidateSmoke.includes("smoke:owner-release-status"),
  "release candidate gate knows owner release status smoke"
);

for (const [file, text] of Object.entries({
  "docs/HWALLET_OWNER_RELEASE_PACKET.md": ownerPacket,
  "docs/HWALLET_WORK_QUEUE.md": workQueue,
  "docs/HWALLET_RELEASE_TASK_LEDGER.md": taskLedger,
  "docs/HWALLET_STORE_SCREENSHOT_PLAN.md": screenshotPlan
})) {
  assertNoRawSecrets(text, file);
}

for (const required of [
  "No secret material is needed now",
  "npm run smoke:owner-release-status",
  "Apple/TestFlight",
  "Google Play internal testing",
  "Approve final store copy and screenshots",
  "Store evidence in ignored `.tmp` files only"
]) {
  assertIncludes(ownerPacket, required, `owner packet includes ${required}`);
}

assertIncludes(workQueue, "npm run smoke:owner-release-status", "work queue exposes owner release status command");
assertIncludes(workQueue, "Stop and ask the owner", "work queue preserves owner stop rule");
assertIncludes(taskLedger, "R-007, R-008, and R-009 are intentionally owner-gated", "release ledger keeps owner-gated tasks");
assertIncludes(screenshotPlan, "Owner Approval Checklist", "screenshot plan keeps owner approval checklist");

const storeConsoleEvidence = await inspectStoreConsoleEvidence(storeConsoleEvidencePath);
const deviceEvidence = {
  ios: await inspectDeviceEvidence(iosDeviceEvidencePath, "ios"),
  android: await inspectDeviceEvidence(androidDeviceEvidencePath, "android")
};

const ownerGatedTaskIds = ["R-007", "R-008", "R-009"];
const nextAction = storeConsoleEvidence.strictReady
  ? {
      kind: "strict-release-handoff",
      label: "商店证据已就绪，可以进入严格发布交接验证",
      command:
        "HWALLET_RELEASE_HANDOFF_STRICT=true " +
        "HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json " +
        "HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json " +
        "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json " +
        "npm run smoke:mobile-release-handoff"
    }
  : {
      kind: "owner-evidence",
      label: "需要老板确认商店侧状态，代码侧可继续做非商店任务",
      taskIds: ownerGatedTaskIds,
      asks: [
        "确认 iOS TestFlight 是否上传、处理完成、可内测、已安装复测",
        "确认 Android 内测是否上传、处理完成、可测试、已安装复测",
        "确认商店文案、截图、隐私/支持链接和审核说明"
      ],
      statusCommand: "npm run smoke:owner-release-status"
    };

const result = {
  ok: true,
  checks,
  release: {
    product: "HWallet wallet entry plus Agent experience",
    apiBaseUrl: "https://app.hwallet.vip",
    liveExecutionClosed: true,
    ownerGatedTaskIds,
    automatableReleaseTasksRemaining: 0
  },
  evidence: {
    storeConsole: storeConsoleEvidence,
    device: deviceEvidence
  },
  nextAction
};

const output = JSON.stringify(result, null, 2);
assertNoRawSecrets(output, "owner-release-status-output");
console.log(output);

async function inspectStoreConsoleEvidence(path) {
  const missingResult = {
    status: "missing",
    path,
    strictReady: false,
    missingForStrict: ["store-console evidence file"]
  };

  if (!(await exists(path))) return missingResult;
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

    const missingForStrict = missingStoreStrictFields(evidence);
    return {
      status: "present",
      path,
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

async function inspectDeviceEvidence(path, expectedPlatform) {
  if (!(await exists(path))) {
    return {
      status: "missing",
      path,
      expectedPlatform
    };
  }

  if (!isGitIgnored(path)) {
    return {
      status: "invalid",
      path,
      expectedPlatform,
      reason: "evidence file is not git ignored"
    };
  }

  try {
    const raw = await readFile(path, "utf8");
    assertNoRawSecrets(raw, path);
    const evidence = JSON.parse(raw);
    if (evidence.kind !== "hwallet-device-multi-user-evidence") {
      return {
        status: "invalid",
        path,
        expectedPlatform,
        reason: "unexpected evidence kind"
      };
    }
    if (evidence.environment?.platform !== expectedPlatform) {
      return {
        status: "invalid",
        path,
        expectedPlatform,
        reason: "platform mismatch"
      };
    }

    return {
      status: "present",
      path,
      platform: evidence.environment.platform,
      buildChannel: evidence.environment.buildChannel,
      appVersion: evidence.environment.appVersion,
      distinctAddresses: evidence.users?.userA?.shortAddress !== evidence.users?.userB?.shortAddress,
      copyFeedbackVisible: evidence.checks?.copyFeedbackVisible === true,
      switchAvailable: evidence.checks?.accountSwitchAvailable === true,
      noCrash: evidence.checks?.appOpensWithoutCrash === true,
      liveExecutionClosed: evidence.confirmations?.liveExecutionStillClosed === true,
      artifacts: Array.isArray(evidence.artifacts) ? evidence.artifacts.length : 0
    };
  } catch (error) {
    return {
      status: "invalid",
      path,
      expectedPlatform,
      reason: redactError(error)
    };
  }
}

function missingStoreStrictFields(evidence) {
  const missing = [];
  const ios = evidence.ios || {};
  const android = evidence.android || {};

  if (!hasText(evidence.operator?.label) || looksUnresolved(evidence.operator?.label)) missing.push("operator label");
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
  if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length < 2) missing.push("redacted console artifacts");

  return missing.slice(0, 12);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });
  return ignoreCheck.status === 0;
}

function assertIncludes(text, value, label) {
  assert(text.includes(value), label);
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
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /0x[a-fA-F0-9]{40}/
  ];

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`Owner release status smoke failed: ${file} must not contain raw secret or personal material`);
    }
  }
}

function redactError(error) {
  return String(error?.message || error || "unknown error")
    .replace(/0x[a-fA-F0-9]{8,}/g, "0x...")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
}

function assert(condition, label) {
  if (!condition) throw new Error(`Owner release status smoke failed: ${label}`);
  checks.push(label);
}
