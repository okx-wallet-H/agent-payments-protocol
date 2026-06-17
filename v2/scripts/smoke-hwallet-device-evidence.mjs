import { readFile } from "node:fs/promises";

const evidencePath =
  process.env.HWALLET_DEVICE_EVIDENCE_FILE ||
  process.argv[2] ||
  "docs/HWALLET_DEVICE_EVIDENCE.example.json";
const isExample = evidencePath.endsWith(".example.json");
const requireRealEvidence = process.env.HWALLET_DEVICE_EVIDENCE_REQUIRED === "true";
const checks = [];

const raw = await readFile(evidencePath, "utf8");
assertNoRawSecrets(raw, evidencePath);
const evidence = JSON.parse(raw);

assert(evidence.kind === "hwallet-device-multi-user-evidence", "evidence kind is HWallet multi-user");
assert(evidence.version === 1, "evidence version is supported");

const environment = evidence.environment || {};
assert(typeof environment.platform === "string" && environment.platform.length > 0, "device platform is recorded");
assert(typeof environment.buildChannel === "string" && environment.buildChannel.length > 0, "build channel is recorded");
assertValidApiBaseUrl(environment.apiBaseUrl);
assert(typeof environment.appVersion === "string" && environment.appVersion.length > 0, "App version is recorded");
assert(typeof environment.buildNumber === "string" && environment.buildNumber.length > 0, "build number is recorded");

const tester = evidence.tester || {};
assert(typeof tester.label === "string" && tester.label.length > 0, "tester label is recorded");
assertValidIsoDate(tester.testedAt, "testedAt is an ISO timestamp");

const userA = evidence.users?.userA || {};
const userB = evidence.users?.userB || {};
assertValidUser(userA, "User A");
assertValidUser(userB, "User B");
assert(userA.emailLabel !== userB.emailLabel, "User A and User B labels are distinct");
assert(userA.shortAddress !== userB.shortAddress, "User A and User B short addresses are distinct");
const confirmations = evidence.confirmations || {};

const requiredChecks = [
  "appOpensWithoutCrash",
  "userALoginCompleted",
  "userBLoginCompleted",
  "accountSwitchAvailable",
  "userAReceiveAddressVisible",
  "userBReceiveAddressVisible",
  "addressesAreDistinct",
  "copyFeedbackVisible",
  "signedOutHidesWalletAddress",
  "switchBackRestoresUserAAddress",
  "noWrongUserDataExposure",
  "transactionHashOptional",
  "liveExecutionClosed"
];

for (const checkName of requiredChecks) {
  assert(evidence.checks?.[checkName] === true, `${checkName} passed`);
}

const requiredFlowSteps = [
  "app-opened",
  "user-a-login",
  "user-a-hwallet-ready",
  "copy-feedback",
  "switch-to-user-b",
  "user-b-login",
  "user-b-hwallet-ready",
  "switch-back-user-a",
  "signed-out-boundary"
];
assert(Array.isArray(evidence.flow), "ordered device flow is present");
let previousFlowIndex = -1;
for (const stepName of requiredFlowSteps) {
  const flowIndex = evidence.flow.findIndex((item) => item?.step === stepName);
  assert(flowIndex > previousFlowIndex, `${stepName} appears in device flow order`);
  const item = evidence.flow[flowIndex];
  assert(item.observed === true, `${stepName} observed`);
  assert(typeof item.label === "string" && item.label.length > 0, `${stepName} label is recorded`);
  previousFlowIndex = flowIndex;
}

assert(Array.isArray(evidence.artifacts), "artifacts list is present");
assert(evidence.artifacts.length >= 2, "at least two redacted artifacts are recorded");
for (const artifact of evidence.artifacts) {
  assert(typeof artifact.label === "string" && artifact.label.length > 0, "artifact label is recorded");
  assert(artifact.redacted === true, "artifact is marked redacted");
}

if (requireRealEvidence) {
  assert(!isExample, "real device evidence file is provided");
  assert(!looksLikeExample(userA.emailLabel), "User A label is not the example value");
  assert(!looksLikeExample(userB.emailLabel), "User B label is not the example value");
  assert(!looksUnresolved(userA.emailLabel), "User A label is filled");
  assert(!looksUnresolved(userB.emailLabel), "User B label is filled");
  assert(!looksUnresolved(userA.shortAddress), "User A short address is filled");
  assert(!looksUnresolved(userB.shortAddress), "User B short address is filled");
  assert(!userA.shortAddress.includes("1111...aaaa"), "User A short address is not the example value");
  assert(!userB.shortAddress.includes("2222...bbbb"), "User B short address is not the example value");
  assert(!/Example only/i.test(String(evidence.notes || "")), "evidence notes are not the example note");
  const requiredConfirmations = [
    "observedOnPhysicalDevice",
    "twoDifferentUsersTested",
    "screenshotsRedacted",
    "containsNoSecrets",
    "liveExecutionStillClosed"
  ];
  for (const confirmationName of requiredConfirmations) {
    assert(confirmations[confirmationName] === true, `${confirmationName} confirmed`);
  }
}

console.log(JSON.stringify({
  ok: true,
  mode: isExample ? "example-template" : "device-evidence",
  evidencePath,
  checks,
  summary: {
    platform: environment.platform,
    buildChannel: environment.buildChannel,
    apiBaseUrl: environment.apiBaseUrl,
    distinctUsers: userA.emailLabel !== userB.emailLabel,
    distinctAddresses: userA.shortAddress !== userB.shortAddress,
    artifacts: evidence.artifacts.length,
    flowSteps: evidence.flow.length,
    realEvidenceRequired: requireRealEvidence
  }
}, null, 2));

function assertValidUser(user, label) {
  assert(typeof user.emailLabel === "string" && user.emailLabel.length > 0, `${label} label is recorded`);
  assert(typeof user.shortAddress === "string" && /^0x[a-fA-F0-9]{4,}\.\.\.[a-fA-F0-9]{4,}$/.test(user.shortAddress), `${label} short address is redacted`);
}

function assertValidApiBaseUrl(value) {
  assert(typeof value === "string" && value.length > 0, "API base URL is recorded");
  const url = new URL(value);
  assert(url.protocol === "https:" || url.hostname.startsWith("10.") || url.hostname.startsWith("192.168."), "API base URL is staging HTTPS or local LAN");
}

function assertValidIsoDate(value, label) {
  assert(typeof value === "string" && !Number.isNaN(Date.parse(value)), label);
}

function looksLikeExample(value) {
  return /example\.com$/i.test(value);
}

function looksUnresolved(value) {
  return /(?:fill|todo|tbd|placeholder|replace)/i.test(String(value || ""));
}

function assertNoRawSecrets(text, file) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/
  ];

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`HWallet device evidence smoke failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet device evidence smoke failed: ${label}`);
  checks.push(label);
}
