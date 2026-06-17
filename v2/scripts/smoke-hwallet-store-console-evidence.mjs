import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const evidencePath =
  process.env.HWALLET_STORE_CONSOLE_EVIDENCE_FILE ||
  process.argv[2] ||
  "docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json";
const isExample = evidencePath.endsWith(".example.json");
const requireRealEvidence = process.env.HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED === "true";
const defaultLocalEvidencePath = ".tmp/hwallet-store-console-evidence.json";
const checks = [];

assertNoRawSecrets(JSON.stringify({
  evidencePath,
  required: requireRealEvidence
}), "store-console-evidence-env");

const raw = await readFile(evidencePath, "utf8");
assertNoRawSecrets(raw, evidencePath);
const evidence = JSON.parse(raw);

assert(evidence.kind === "hwallet-store-console-evidence", "evidence kind is HWallet store console");
assert(evidence.version === 1, "evidence version is supported");

const environment = evidence.environment || {};
assert(environment.appVersion === "0.1.0", "App version is recorded");
assert(environment.iosBundleIdentifier === "com.agentwallet.xlayer", "iOS bundle id is recorded");
assert(environment.androidPackage === "com.agentwallet.xlayer", "Android package is recorded");
assertValidHttpsUrl(environment.apiBaseUrl, "API base URL");
assert(["internal", "external", "production"].includes(environment.releaseTrack), "release track is supported");

const operator = evidence.operator || {};
assert(typeof operator.label === "string" && operator.label.length > 0, "operator label is recorded");
assertValidIsoDate(operator.recordedAt, "recordedAt is an ISO timestamp");

assertPlatform(evidence.ios || {}, "ios");
assertPlatform(evidence.android || {}, "android");
assert(evidence.ios.buildId !== evidence.android.buildId, "iOS and Android build ids are distinct");

for (const checkName of [
  "strictReleaseHandoffPassed",
  "storeSubmissionSmokePassed",
  "dualDeviceEvidencePassed",
  "liveExecutionClosed",
  "noSecretsCommitted"
]) {
  assert(evidence.checks?.[checkName] === true, `${checkName} passed`);
}

for (const confirmationName of [
  "noCredentialsInEvidence",
  "noVerificationCodesInEvidence",
  "screenshotsRedactedOrExternal",
  "readyForInternalReview"
]) {
  assert(evidence.confirmations?.[confirmationName] === true, `${confirmationName} confirmed`);
}

assert(Array.isArray(evidence.artifacts), "artifacts list is present");
assert(evidence.artifacts.length >= 2, "at least two redacted console artifacts are recorded");
for (const artifact of evidence.artifacts) {
  assert(typeof artifact.label === "string" && artifact.label.length > 0, "artifact label is recorded");
  assert(artifact.redacted === true, "artifact is marked redacted");
}

if (requireRealEvidence) {
  assert(!isExample, "real store console evidence file is provided");
  assertGitIgnored(evidencePath);
  assert(!looksUnresolved(operator.label), "operator label is filled");
  assert(!looksUnresolved(evidence.ios.appRecordLabel), "iOS app record label is filled");
  assert(!looksUnresolved(evidence.android.appRecordLabel), "Android app record label is filled");
  assert(!isExampleBuildId(evidence.ios.buildId), "iOS build id is not the example value");
  assert(!isExampleBuildId(evidence.android.buildId), "Android build id is not the example value");
  assert(!/Example only/i.test(String(evidence.notes || "")), "evidence notes are not the example note");
}

console.log(JSON.stringify({
  ok: true,
  mode: isExample ? "example-template" : "store-console-evidence",
  evidencePath,
  checks,
  ...(!requireRealEvidence ? {
    localEvidence: await inspectOptionalEvidence(defaultLocalEvidencePath),
    nextStrictCommand:
      "HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json " +
      "HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence"
  } : {}),
  summary: {
    appVersion: environment.appVersion,
    iosStatus: evidence.ios.status,
    androidStatus: evidence.android.status,
    releaseTrack: environment.releaseTrack,
    realEvidenceRequired: requireRealEvidence
  }
}, null, 2));

function assertPlatform(platformEvidence, platform) {
  const label = platform === "ios" ? "iOS" : "Android";
  const expectedConsole = platform === "ios" ? "App Store Connect" : "Google Play Console";
  const expectedStatusKey = platform === "ios" ? "testflight" : "internalTesting";

  assert(platformEvidence.console === expectedConsole, `${label} console is recorded`);
  assert(["ready", "pending", "blocked"].includes(platformEvidence.status), `${label} status is supported`);
  assertValidBuildId(platformEvidence.buildId, `${label} build id`);
  assert(typeof platformEvidence.appRecordLabel === "string" && platformEvidence.appRecordLabel.length > 0, `${label} app record label is recorded`);
  assert(Object.values(platformEvidence[expectedStatusKey] || {}).every((value) => value === true), `${label} console status checklist passed`);
  assert(Object.values(platformEvidence.metadata || {}).every((value) => value === true), `${label} metadata checklist passed`);

  if (platform === "ios") {
    assert(String(platformEvidence.buildNumber || "").length > 0, "iOS build number is recorded");
  } else {
    assert(Number(platformEvidence.versionCode) > 0, "Android version code is recorded");
  }
}

function assertValidBuildId(value, label) {
  assert(typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), `${label} is a UUID`);
}

function assertValidHttpsUrl(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} is recorded`);
  const url = new URL(value);
  assert(url.protocol === "https:", `${label} uses HTTPS`);
}

function assertValidIsoDate(value, label) {
  assert(typeof value === "string" && !Number.isNaN(Date.parse(value)), label);
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

function assertGitIgnored(path) {
  if (!isGitIgnored(path)) {
    throw new Error(`${path} is not ignored by git. Keep store console evidence in ignored .tmp files.`);
  }
}

function isGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  return ignoreCheck.status === 0;
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
      throw new Error(`Store console evidence smoke failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Store console evidence smoke failed: ${label}`);
  checks.push(label);
}

async function inspectOptionalEvidence(path) {
  try {
    await access(path);
  } catch {
    return {
      status: "missing",
      path
    };
  }

  try {
    if (!isGitIgnored(path)) {
      return {
        status: "invalid",
        path,
        reason: "evidence file is not git ignored"
      };
    }

    const raw = await readFile(path, "utf8");
    assertNoRawSecrets(raw, path);
    const evidence = JSON.parse(raw);
    if (evidence.kind !== "hwallet-store-console-evidence") {
      return {
        status: "invalid",
        path,
        reason: "unexpected evidence kind"
      };
    }
    if (evidence.version !== 1) {
      return {
        status: "invalid",
        path,
        reason: "unsupported evidence version"
      };
    }

    return {
      status: "present",
      path,
      appVersion: evidence.environment?.appVersion,
      apiBaseUrl: evidence.environment?.apiBaseUrl,
      releaseTrack: evidence.environment?.releaseTrack,
      iosStatus: evidence.ios?.status,
      androidStatus: evidence.android?.status,
      artifacts: Array.isArray(evidence.artifacts) ? evidence.artifacts.length : 0,
      strictReady: isStrictReady(evidence),
      missingForStrict: missingStrictFields(evidence)
    };
  } catch (error) {
    return {
      status: "invalid",
      path,
      reason: redactError(error)
    };
  }
}

function isStrictReady(evidence) {
  return missingStrictFields(evidence).length === 0;
}

function missingStrictFields(evidence) {
  const missing = [];
  const ios = evidence.ios || {};
  const android = evidence.android || {};

  if (!hasText(evidence.operator?.label)) {
    missing.push("operator label");
  } else if (looksUnresolved(evidence.operator.label)) {
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function redactError(error) {
  return String(error?.message || error || "unknown error")
    .replace(/0x[a-fA-F0-9]{8,}/g, "0x...")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
}
