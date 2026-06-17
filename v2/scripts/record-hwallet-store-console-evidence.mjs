import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json";
const outputPath =
  process.env.HWALLET_STORE_CONSOLE_EVIDENCE_FILE ||
  ".tmp/hwallet-store-console-evidence.json";
const storeBuildEvidencePath =
  process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE ||
  ".tmp/hwallet-mobile-store-build-evidence.json";
const mobileApp = JSON.parse(await readFile("apps/mobile/app.json", "utf8")).expo || {};
const { evidence: source, fromExample } = await readEvidence();
const storeBuildEvidence = await readOptionalStoreBuildEvidence(storeBuildEvidencePath);
const confirmAll = process.env.HWALLET_STORE_CONSOLE_EVIDENCE_CONFIRM_ALL === "true";

const evidence = normalizeEvidence(source);
evidence.ios = applyIosUpdate(evidence.ios);
evidence.android = applyAndroidUpdate(evidence.android);
evidence.checks = applyChecks(evidence.checks, confirmAll);
evidence.confirmations = applyConfirmations(evidence.confirmations, confirmAll);
evidence.artifacts = buildArtifacts(evidence);
evidence.notes =
  "Recorded by hwallet:store-console-evidence:record. " +
  "This ignored file stores redacted App Store Connect and Google Play Console observations only.";

assertNoRawSecrets(JSON.stringify(evidence), outputPath);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
assertGitIgnored(outputPath);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  iosStatus: evidence.ios.status,
  androidStatus: evidence.android.status,
  importedBuildEvidence: Boolean(storeBuildEvidence),
  storeBuildEvidencePath: storeBuildEvidence ? storeBuildEvidencePath : undefined,
  strictReady: isStrictReady(evidence),
  nextStep: `HWALLET_STORE_CONSOLE_EVIDENCE_FILE=${outputPath} HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence`
}, null, 2));

async function readEvidence() {
  if (await exists(outputPath)) {
    const raw = await readFile(outputPath, "utf8");
    assertNoRawSecrets(raw, outputPath);
    return {
      evidence: JSON.parse(raw),
      fromExample: false
    };
  }

  const raw = await readFile(sourcePath, "utf8");
  assertNoRawSecrets(raw, sourcePath);
  return {
    evidence: JSON.parse(raw),
    fromExample: true
  };
}

function normalizeEvidence(evidence) {
  return {
    ...evidence,
    environment: {
      ...evidence.environment,
      appVersion: mobileApp.version || evidence.environment?.appVersion || "0.1.0",
      iosBundleIdentifier:
        mobileApp.ios?.bundleIdentifier || evidence.environment?.iosBundleIdentifier || "com.agentwallet.xlayer",
      androidPackage: mobileApp.android?.package || evidence.environment?.androidPackage || "com.agentwallet.xlayer",
      apiBaseUrl: process.env.HWALLET_STORE_CONSOLE_API_BASE_URL || "https://app.hwallet.vip",
      releaseTrack: process.env.HWALLET_STORE_CONSOLE_RELEASE_TRACK || evidence.environment?.releaseTrack || "internal"
    },
    operator: {
      label: realValue(process.env.HWALLET_STORE_CONSOLE_OPERATOR) ||
        realValue(evidence.operator?.label) ||
        "owner-redacted",
      recordedAt: new Date().toISOString()
    },
    ios: evidence.ios || {},
    android: evidence.android || {},
    checks: evidence.checks || {},
    confirmations: evidence.confirmations || {}
  };
}

function applyIosUpdate(ios) {
  const metadata = ios.metadata || {};
  const testflight = ios.testflight || {};
  const iosBuildEvidence = storeBuildEvidence?.builds?.ios || {};
  const buildEnvironment = storeBuildEvidence?.environment || {};
  return {
    ...ios,
    status: process.env.HWALLET_STORE_CONSOLE_IOS_STATUS || safeExisting(ios.status) || "pending",
    buildId: process.env.HWALLET_STORE_CONSOLE_IOS_BUILD_ID ||
      realBuildId(iosBuildEvidence.buildId) ||
      safeExisting(ios.buildId) ||
      "fill-ios-eas-build-id",
    buildNumber: mobileApp.ios?.buildNumber || buildEnvironment.iosBuildNumber || safeExisting(ios.buildNumber) || "9",
    appRecordLabel:
      realValue(process.env.HWALLET_STORE_CONSOLE_IOS_APP_LABEL) ||
      realValue(safeExisting(ios.appRecordLabel)) ||
      "hwallet-ios-app-record-redacted",
    testflight: {
      buildUploaded: boolEnv("HWALLET_STORE_CONSOLE_IOS_BUILD_UPLOADED", safeExisting(testflight.buildUploaded)),
      processingComplete: boolEnv("HWALLET_STORE_CONSOLE_IOS_PROCESSING_COMPLETE", safeExisting(testflight.processingComplete)),
      internalTestingReady: boolEnv("HWALLET_STORE_CONSOLE_IOS_INTERNAL_READY", safeExisting(testflight.internalTestingReady)),
      installedAndRetested: boolEnv("HWALLET_STORE_CONSOLE_IOS_RETESTED", safeExisting(testflight.installedAndRetested))
    },
    metadata: {
      privacyPolicyUrlSet: boolEnv("HWALLET_STORE_CONSOLE_IOS_PRIVACY_URL_SET", safeExisting(metadata.privacyPolicyUrlSet)),
      supportUrlSet: boolEnv("HWALLET_STORE_CONSOLE_IOS_SUPPORT_URL_SET", safeExisting(metadata.supportUrlSet)),
      reviewNotesObserveOnly: boolEnv("HWALLET_STORE_CONSOLE_IOS_REVIEW_NOTES_SET", safeExisting(metadata.reviewNotesObserveOnly)),
      screenshotsOwnerApproved: boolEnv("HWALLET_STORE_CONSOLE_IOS_SCREENSHOTS_APPROVED", safeExisting(metadata.screenshotsOwnerApproved))
    }
  };
}

function applyAndroidUpdate(android) {
  const metadata = android.metadata || {};
  const internalTesting = android.internalTesting || {};
  const androidBuildEvidence = storeBuildEvidence?.builds?.android || {};
  const buildEnvironment = storeBuildEvidence?.environment || {};
  return {
    ...android,
    status: process.env.HWALLET_STORE_CONSOLE_ANDROID_STATUS || safeExisting(android.status) || "pending",
    buildId: process.env.HWALLET_STORE_CONSOLE_ANDROID_BUILD_ID ||
      realBuildId(androidBuildEvidence.buildId) ||
      safeExisting(android.buildId) ||
      "fill-android-eas-build-id",
    versionCode: mobileApp.android?.versionCode || buildEnvironment.androidVersionCode || safeExisting(android.versionCode) || 9,
    appRecordLabel:
      realValue(process.env.HWALLET_STORE_CONSOLE_ANDROID_APP_LABEL) ||
      realValue(safeExisting(android.appRecordLabel)) ||
      "hwallet-android-app-record-redacted",
    internalTesting: {
      buildUploaded: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_BUILD_UPLOADED", safeExisting(internalTesting.buildUploaded)),
      processingComplete: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_PROCESSING_COMPLETE", safeExisting(internalTesting.processingComplete)),
      testerTrackReady: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_TRACK_READY", safeExisting(internalTesting.testerTrackReady)),
      installedAndRetested: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_RETESTED", safeExisting(internalTesting.installedAndRetested))
    },
    metadata: {
      privacyPolicyUrlSet: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_PRIVACY_URL_SET", safeExisting(metadata.privacyPolicyUrlSet)),
      supportUrlSet: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_SUPPORT_URL_SET", safeExisting(metadata.supportUrlSet)),
      dataSafetyCompleted: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_DATA_SAFETY_DONE", safeExisting(metadata.dataSafetyCompleted)),
      contentRatingCompleted: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_CONTENT_RATING_DONE", safeExisting(metadata.contentRatingCompleted)),
      screenshotsOwnerApproved: boolEnv("HWALLET_STORE_CONSOLE_ANDROID_SCREENSHOTS_APPROVED", safeExisting(metadata.screenshotsOwnerApproved))
    }
  };
}

function applyChecks(checks, confirmAll) {
  return {
    ...checks,
    strictReleaseHandoffPassed:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_STRICT_HANDOFF_PASSED", safeExisting(checks.strictReleaseHandoffPassed)),
    storeSubmissionSmokePassed:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_SUBMISSION_SMOKE_PASSED", safeExisting(checks.storeSubmissionSmokePassed)),
    dualDeviceEvidencePassed:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_DUAL_DEVICE_PASSED", safeExisting(checks.dualDeviceEvidencePassed)),
    liveExecutionClosed:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_LIVE_EXECUTION_CLOSED", safeExisting(checks.liveExecutionClosed)),
    noSecretsCommitted:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_NO_SECRETS_COMMITTED", safeExisting(checks.noSecretsCommitted))
  };
}

function applyConfirmations(confirmations, confirmAll) {
  return {
    ...confirmations,
    noCredentialsInEvidence:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_NO_CREDENTIALS", safeExisting(confirmations.noCredentialsInEvidence)),
    noVerificationCodesInEvidence:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_NO_CODES", safeExisting(confirmations.noVerificationCodesInEvidence)),
    screenshotsRedactedOrExternal:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_SCREENSHOTS_REDACTED", safeExisting(confirmations.screenshotsRedactedOrExternal)),
    readyForInternalReview:
      confirmAll || boolEnv("HWALLET_STORE_CONSOLE_READY_FOR_INTERNAL_REVIEW", safeExisting(confirmations.readyForInternalReview))
  };
}

function buildArtifacts(evidence) {
  return [
    {
      label: `ios-${safeLabel(evidence.ios.appRecordLabel)}`,
      redacted: true
    },
    {
      label: `android-${safeLabel(evidence.android.appRecordLabel)}`,
      redacted: true
    }
  ];
}

function boolEnv(name, fallback) {
  if (process.env.HWALLET_STORE_CONSOLE_EVIDENCE_CONFIRM_ALL === "true") return true;
  if (process.env[name] === "true") return true;
  if (process.env[name] === "false") return false;
  return fallback === true;
}

function safeExisting(value) {
  return fromExample ? undefined : value;
}

function isStrictReady(evidence) {
  return (
    evidence.ios.status === "ready" &&
    evidence.android.status === "ready" &&
    Object.values(evidence.ios.testflight || {}).every(Boolean) &&
    Object.values(evidence.ios.metadata || {}).every(Boolean) &&
    Object.values(evidence.android.internalTesting || {}).every(Boolean) &&
    Object.values(evidence.android.metadata || {}).every(Boolean) &&
    Object.values(evidence.checks || {}).every(Boolean) &&
    Object.values(evidence.confirmations || {}).every(Boolean)
  );
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalStoreBuildEvidence(path) {
  if (!(await exists(path))) return null;
  assertGitIgnored(path);
  const raw = await readFile(path, "utf8");
  assertNoRawSecrets(raw, path);
  const evidence = JSON.parse(raw);
  if (evidence.kind !== "hwallet-mobile-store-build-evidence") {
    throw new Error(`${path} is not HWallet mobile store build evidence`);
  }
  if (evidence.version !== 1) {
    throw new Error(`${path} has unsupported mobile store build evidence version`);
  }
  return evidence;
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before using real store console evidence.`);
  }
}

function safeLabel(value) {
  return String(value || "redacted").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80);
}

function realValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(fill|todo|replace|unresolved|example)(?:[-_\s]|$)/i.test(text)) return "";
  return text;
}

function realBuildId(value) {
  const text = realValue(value);
  if (!text || looksUnresolved(text)) return "";
  return text;
}

function looksUnresolved(value) {
  return (
    /(?:fill|todo|tbd|placeholder|replace)/i.test(String(value || "")) ||
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
      throw new Error(`${file} must not contain raw secret material`);
    }
  }
}
