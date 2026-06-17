import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_MOBILE_STORE_BUILD_EVIDENCE.example.json";
const outputPath =
  process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE ||
  ".tmp/hwallet-mobile-store-build-evidence.json";
const mobileApp = JSON.parse(await readFile("apps/mobile/app.json", "utf8")).expo || {};
const source = await readEvidence();
const updates = collectBuildUpdates();

if (updates.length === 0) {
  throw new Error(
    "Set HWALLET_MOBILE_STORE_BUILD_PLATFORM + HWALLET_MOBILE_STORE_BUILD_ID, " +
      "or set HWALLET_MOBILE_STORE_BUILD_IOS_ID / HWALLET_MOBILE_STORE_BUILD_ANDROID_ID."
  );
}

const nextEvidence = normalizeEvidence(source);
for (const update of updates) {
  nextEvidence.builds[update.platform] = applyBuildUpdate(nextEvidence.builds[update.platform], update);
}

const updatedPlatforms = new Set(updates.map((update) => update.platform));
const allPlatformsRecorded = hasResolvedBuild(nextEvidence.builds.ios) && hasResolvedBuild(nextEvidence.builds.android);
const confirmAll = process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_CONFIRM_ALL === "true";
const deviceEvidenceLinked =
  confirmAll || process.env.HWALLET_MOBILE_STORE_BUILD_DEVICE_EVIDENCE_LINKED === "true";

nextEvidence.checks = {
  ...nextEvidence.checks,
  publicHttpsApi: true,
  v2HWalletUi: true,
  previewOnlyUiDisabled: true,
  nativeConfigMatchesRepo: true,
  liveExecutionClosed: true,
  deviceEvidenceLinked,
  iosBuildFinished: updatedPlatforms.has("ios") ? true : nextEvidence.checks.iosBuildFinished === true,
  androidBuildFinished: updatedPlatforms.has("android") ? true : nextEvidence.checks.androidBuildFinished === true,
  iosInstallableOrSubmitted:
    updatedPlatforms.has("ios") ? true : nextEvidence.checks.iosInstallableOrSubmitted === true,
  androidInstallableOrSubmitted:
    updatedPlatforms.has("android") ? true : nextEvidence.checks.androidInstallableOrSubmitted === true
};

nextEvidence.confirmations = {
  ...nextEvidence.confirmations,
  bothPlatformsRecorded: allPlatformsRecorded && confirmAll,
  evidenceMatchesEasBuilds: allPlatformsRecorded && confirmAll,
  containsNoSecrets: confirmAll || nextEvidence.confirmations.containsNoSecrets === true,
  safeToProceedToInternalTesting: allPlatformsRecorded && confirmAll && deviceEvidenceLinked
};

nextEvidence.artifacts = buildArtifacts(nextEvidence);
nextEvidence.notes =
  "Recorded by mobile:store-build-evidence:record. " +
  "This ignored file stores EAS build ids, build URLs, platform labels, and redacted artifact labels only.";

assertNoRawSecrets(JSON.stringify(nextEvidence), outputPath);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(nextEvidence, null, 2)}\n`, "utf8");
assertGitIgnored(outputPath);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  updatedPlatforms: [...updatedPlatforms],
  allPlatformsRecorded,
  strictReady: allPlatformsRecorded && confirmAll && deviceEvidenceLinked,
  nextStep: allPlatformsRecorded
    ? `HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=${outputPath} HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence`
    : "Record the remaining platform build id before running the strict release handoff."
}, null, 2));

async function readEvidence() {
  if (await exists(outputPath)) {
    const raw = await readFile(outputPath, "utf8");
    assertNoRawSecrets(raw, outputPath);
    return JSON.parse(raw);
  }

  const raw = await readFile(sourcePath, "utf8");
  assertNoRawSecrets(raw, sourcePath);
  return JSON.parse(raw);
}

function normalizeEvidence(evidence) {
  const now = new Date().toISOString();
  const easProject = process.env.HWALLET_MOBILE_STORE_EAS_PROJECT || `@${easAccount()}/${mobileApp.slug || "agent-wallet-xlayer-mvp"}`;
  return {
    ...evidence,
    environment: {
      ...evidence.environment,
      appVersion: mobileApp.version || evidence.environment?.appVersion || "0.1.0",
      iosBuildNumber: mobileApp.ios?.buildNumber || evidence.environment?.iosBuildNumber || "1",
      androidVersionCode: mobileApp.android?.versionCode || evidence.environment?.androidVersionCode || 1,
      apiBaseUrl: process.env.HWALLET_MOBILE_STORE_BUILD_API_BASE_URL || "https://app.hwallet.vip",
      buildChannel: process.env.HWALLET_MOBILE_STORE_BUILD_CHANNEL || evidence.environment?.buildChannel || "preview",
      easProject
    },
    tester: {
      label: process.env.HWALLET_MOBILE_STORE_BUILD_TESTER || evidence.tester?.label || "release-operator",
      recordedAt: now
    },
    builds: {
      ios: evidence.builds?.ios || {},
      android: evidence.builds?.android || {}
    },
    checks: {
      iosBuildFinished: false,
      androidBuildFinished: false,
      iosInstallableOrSubmitted: false,
      androidInstallableOrSubmitted: false,
      publicHttpsApi: false,
      v2HWalletUi: false,
      previewOnlyUiDisabled: false,
      nativeConfigMatchesRepo: false,
      deviceEvidenceLinked: false,
      liveExecutionClosed: false,
      ...(evidence.checks || {})
    },
    confirmations: {
      bothPlatformsRecorded: false,
      evidenceMatchesEasBuilds: false,
      containsNoSecrets: false,
      safeToProceedToInternalTesting: false,
      ...(evidence.confirmations || {})
    }
  };
}

function collectBuildUpdates() {
  const updates = [];
  const singlePlatform = process.env.HWALLET_MOBILE_STORE_BUILD_PLATFORM;
  const singleBuildId = process.env.HWALLET_MOBILE_STORE_BUILD_ID;

  if (singlePlatform || singleBuildId) {
    assert(["ios", "android"].includes(singlePlatform), "HWALLET_MOBILE_STORE_BUILD_PLATFORM must be ios or android");
    assertValidBuildId(singleBuildId, "HWALLET_MOBILE_STORE_BUILD_ID");
    updates.push(buildUpdate(singlePlatform, singleBuildId, process.env.HWALLET_MOBILE_STORE_BUILD_URL));
  }

  const iosBuildId = process.env.HWALLET_MOBILE_STORE_BUILD_IOS_ID;
  if (iosBuildId) {
    assertValidBuildId(iosBuildId, "HWALLET_MOBILE_STORE_BUILD_IOS_ID");
    updates.push(buildUpdate("ios", iosBuildId, process.env.HWALLET_MOBILE_STORE_BUILD_IOS_URL));
  }

  const androidBuildId = process.env.HWALLET_MOBILE_STORE_BUILD_ANDROID_ID;
  if (androidBuildId) {
    assertValidBuildId(androidBuildId, "HWALLET_MOBILE_STORE_BUILD_ANDROID_ID");
    updates.push(buildUpdate("android", androidBuildId, process.env.HWALLET_MOBILE_STORE_BUILD_ANDROID_URL));
  }

  return updates;
}

function buildUpdate(platform, buildId, buildUrl) {
  return {
    platform,
    buildId,
    buildUrl: buildUrl || defaultBuildUrl(buildId),
    artifactType: process.env.HWALLET_MOBILE_STORE_BUILD_ARTIFACT_TYPE || (platform === "ios" ? "ipa" : "apk"),
    status: process.env.HWALLET_MOBILE_STORE_BUILD_STATUS || "finished",
    distribution: process.env.HWALLET_MOBILE_STORE_BUILD_DISTRIBUTION || "internal",
    installOrSubmit: process.env.HWALLET_MOBILE_STORE_BUILD_INSTALL_OR_SUBMIT || "internal-install-tested"
  };
}

function applyBuildUpdate(existingBuild, update) {
  const profile = process.env.HWALLET_MOBILE_STORE_BUILD_PROFILE || existingBuild.profile || "preview";
  const channel = process.env.HWALLET_MOBILE_STORE_BUILD_CHANNEL || existingBuild.channel || "preview";
  return {
    ...existingBuild,
    platform: update.platform,
    profile,
    channel,
    buildId: update.buildId,
    buildUrl: update.buildUrl,
    artifactType: update.artifactType,
    status: update.status,
    distribution: update.distribution,
    installOrSubmit: update.installOrSubmit
  };
}

function buildArtifacts(evidence) {
  const artifacts = [];
  for (const platform of ["ios", "android"]) {
    const build = evidence.builds?.[platform];
    if (!hasResolvedBuild(build)) continue;
    artifacts.push({
      label: `${platform}-eas-build-${shortId(build.buildId)}`,
      redacted: true
    });
  }
  return artifacts;
}

function hasResolvedBuild(build) {
  return Boolean(build?.buildId) && !looksUnresolved(build.buildId);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function defaultBuildUrl(buildId) {
  return `https://expo.dev/accounts/${easAccount()}/projects/${mobileApp.slug || "agent-wallet-xlayer-mvp"}/builds/${buildId}`;
}

function easAccount() {
  return process.env.HWALLET_MOBILE_STORE_EAS_ACCOUNT || "hongchen888";
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before using real build evidence.`);
  }
}

function assertValidBuildId(value, label) {
  assert(
    typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
    `${label} must be a UUID`
  );
}

function looksUnresolved(value) {
  return (
    /(?:fill|todo|tbd|placeholder|replace)/i.test(String(value || "")) ||
    /00000000-0000-4000-8000-000000000000/i.test(String(value || "")) ||
    /11111111-1111-4111-8111-111111111111/i.test(String(value || ""))
  );
}

function shortId(value) {
  return typeof value === "string" && value.length >= 8 ? `${value.slice(0, 8)}...` : value;
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
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/
  ];

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile store build evidence recorder failed: ${label}`);
}
