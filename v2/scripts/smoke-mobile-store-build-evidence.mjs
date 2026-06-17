import { readFile } from "node:fs/promises";

const evidencePath =
  process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE ||
  process.argv[2] ||
  "docs/HWALLET_MOBILE_STORE_BUILD_EVIDENCE.example.json";
const isExample = evidencePath.endsWith(".example.json");
const requireRealEvidence = process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED === "true";
const checks = [];

const raw = await readFile(evidencePath, "utf8");
assertNoRawSecrets(raw, evidencePath);
const evidence = JSON.parse(raw);

assert(evidence.kind === "hwallet-mobile-store-build-evidence", "evidence kind is HWallet mobile store build");
assert(evidence.version === 1, "evidence version is supported");

const environment = evidence.environment || {};
assert(typeof environment.appVersion === "string" && environment.appVersion.length > 0, "App version is recorded");
assert(String(environment.iosBuildNumber || "").length > 0, "iOS build number is recorded");
assert(Number(environment.androidVersionCode) > 0, "Android version code is recorded");
assertValidHttpsUrl(environment.apiBaseUrl, "API base URL");
assert(typeof environment.buildChannel === "string" && environment.buildChannel.length > 0, "build channel is recorded");
assert(environment.publicAppName === "海豚社区", "public app name is recorded");
assert(environment.internalWalletModule === "HWallet", "internal wallet module is recorded");
assert(environment.iconSource === "owner-approved-haitun-logo", "owner-approved icon source is recorded");
assert(typeof environment.easProject === "string" && environment.easProject.includes("/"), "EAS project is recorded");

const tester = evidence.tester || {};
assert(typeof tester.label === "string" && tester.label.length > 0, "tester label is recorded");
assertValidIsoDate(tester.recordedAt, "recordedAt is an ISO timestamp");

const iosBuild = evidence.builds?.ios || {};
const androidBuild = evidence.builds?.android || {};
assertValidBuild(iosBuild, "ios", ["ipa"]);
assertValidBuild(androidBuild, "android", ["apk", "aab"]);
assert(iosBuild.buildId !== androidBuild.buildId, "iOS and Android build ids are distinct");
assert(iosBuild.buildUrl !== androidBuild.buildUrl, "iOS and Android build URLs are distinct");

const requiredChecks = [
  "iosBuildFinished",
  "androidBuildFinished",
  "iosInstallableOrSubmitted",
  "androidInstallableOrSubmitted",
  "publicHttpsApi",
  "v2HWalletUi",
  "previewOnlyUiDisabled",
  "nativeConfigMatchesRepo",
  "publicAppNameMatchesRepo",
  "iconAssetsMatchOwnerLogo",
  "deviceEvidenceLinked",
  "liveExecutionClosed"
];

for (const checkName of requiredChecks) {
  assert(evidence.checks?.[checkName] === true, `${checkName} passed`);
}

const confirmations = evidence.confirmations || {};
const requiredConfirmations = [
  "bothPlatformsRecorded",
  "evidenceMatchesEasBuilds",
  "containsNoSecrets",
  "safeToProceedToInternalTesting"
];

for (const confirmationName of requiredConfirmations) {
  assert(confirmations[confirmationName] === true, `${confirmationName} confirmed`);
}

assert(Array.isArray(evidence.artifacts), "artifacts list is present");
assert(evidence.artifacts.length >= 2, "at least two redacted build artifacts are recorded");
for (const artifact of evidence.artifacts) {
  assert(typeof artifact.label === "string" && artifact.label.length > 0, "artifact label is recorded");
  assert(artifact.redacted === true, "artifact is marked redacted");
}

if (requireRealEvidence) {
  assert(!isExample, "real mobile store build evidence file is provided");
  assert(!looksUnresolved(tester.label), "tester label is filled");
  assert(!looksUnresolved(environment.appVersion), "App version is filled");
  assert(!looksUnresolved(environment.iosBuildNumber), "iOS build number is filled");
  assert(!looksUnresolved(environment.androidVersionCode), "Android version code is filled");
  assert(!looksUnresolved(iosBuild.buildId), "iOS build id is filled");
  assert(!looksUnresolved(androidBuild.buildId), "Android build id is filled");
  assert(!/00000000-0000-4000-8000-000000000000/i.test(iosBuild.buildId), "iOS build id is not the example value");
  assert(!/11111111-1111-4111-8111-111111111111/i.test(androidBuild.buildId), "Android build id is not the example value");
  assert(!/Example only/i.test(String(evidence.notes || "")), "evidence notes are not the example note");
}

console.log(JSON.stringify({
  ok: true,
  mode: isExample ? "example-template" : "store-build-evidence",
  evidencePath,
  checks,
  summary: {
    appVersion: environment.appVersion,
    iosBuildNumber: environment.iosBuildNumber,
    androidVersionCode: environment.androidVersionCode,
    buildChannel: environment.buildChannel,
    iosBuildId: shortId(iosBuild.buildId),
    androidBuildId: shortId(androidBuild.buildId),
    realEvidenceRequired: requireRealEvidence
  }
}, null, 2));

function assertValidBuild(build, platform, allowedArtifactTypes) {
  const label = platform === "ios" ? "iOS" : "Android";
  assert(build.platform === platform, `${label} platform is recorded`);
  assert(typeof build.profile === "string" && build.profile.length > 0, `${label} EAS profile is recorded`);
  assert(typeof build.channel === "string" && build.channel.length > 0, `${label} update channel is recorded`);
  assertValidBuildId(build.buildId, `${label} build id`);
  assertValidHttpsUrl(build.buildUrl, `${label} build URL`);
  assert(build.buildUrl.includes(build.buildId), `${label} build URL includes build id`);
  assert(allowedArtifactTypes.includes(build.artifactType), `${label} artifact type is supported`);
  assert(build.status === "finished", `${label} build status is finished`);
  assert(["internal", "store"].includes(build.distribution), `${label} distribution is supported`);
  assert(
    ["internal-install-tested", "submitted", "ready-to-submit"].includes(build.installOrSubmit),
    `${label} install or submit status is recorded`
  );
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
      throw new Error(`Mobile store build evidence smoke failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile store build evidence smoke failed: ${label}`);
  checks.push(label);
}
