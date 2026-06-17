import { readFile } from "node:fs/promises";

const evidencePath =
  process.env.HWALLET_STAGING_STORAGE_EVIDENCE_FILE ||
  process.argv[2] ||
  "docs/HWALLET_STAGING_STORAGE_EVIDENCE.example.json";
const requireRealEvidence = process.env.HWALLET_STAGING_STORAGE_EVIDENCE_REQUIRED === "true";
const isExample = evidencePath.endsWith(".example.json");
const checks = [];

const raw = await readFile(evidencePath, "utf8");
assertNoRawSecrets(raw, evidencePath);
const evidence = JSON.parse(raw);

assert(evidence.kind === "hwallet-staging-storage-evidence", "evidence kind is HWallet staging storage");
assert(evidence.version === 1, "evidence version is supported");

const environment = evidence.environment || {};
assertValidApiBaseUrl(environment.apiBaseUrl);
assertValidIsoDate(environment.checkedAt, "checkedAt is an ISO timestamp");
assert(typeof environment.source === "string" && environment.source.length > 0, "evidence source is recorded");

const storage = evidence.storage || {};
assert(storage.service === "hwallet-v2", "storage service is HWallet v2");
assert(storage.mode === "postgres", "storage mode is postgres");
assert(storage.activeWritePath === "postgres", "active write path is postgres");
assert(storage.productionReady === true, "postgres storage is production-ready");
assert(storage.postgresStatus === "ready", "postgres status is ready");
assert(Number(storage.expectedTables) >= 13, "expected HWallet table count is recorded");
assert(Number(storage.presentTables) >= 13, "present HWallet table count is recorded");
assert(Number(storage.missingTables) === 0, "no HWallet tables are missing");
assert(Number(storage.warnings) === 0, "staging storage has no warnings");

const accessControl = evidence.accessControl || {};
assert(accessControl.requireOwner === true, "owner guard is enabled");
assert(accessControl.requirePrivyToken === true, "Privy token is required");
assert(accessControl.enforcement === "privy_access_token", "auth enforcement is Privy token based");

const execution = evidence.execution || {};
assert(execution.canBroadcastTransactions === false, "transaction broadcast is closed");
assert(execution.realExecutionEnabled === false, "Agent real execution is closed");
assert(execution.onchainOsLiveMode === false, "Onchain OS live mode is closed");
assert(execution.predictionTradingLiveMode === false, "prediction trading live mode is closed");
assert(execution.publicTradingApiConfigured === false, "public trading API execution is closed");

const protectedProbe = evidence.protectedProbe || {};
assert(protectedProbe.mobileWalletRejectsMissingToken === true, "mobile wallet endpoint rejects missing token");
assert(protectedProbe.errorCode === "Missing Privy access token", "protected probe records expected missing-token code");

const requiredChecks = [
  "storageEndpointHealthy",
  "authEndpointHealthy",
  "executionEndpointHealthy",
  "postgresReady",
  "allTablesPresent",
  "authRequired",
  "ownerGuardEnabled",
  "liveExecutionClosed",
  "protectedEndpointRequiresToken",
  "containsNoSecrets"
];

for (const checkName of requiredChecks) {
  assert(evidence.checks?.[checkName] === true, `${checkName} passed`);
}

if (requireRealEvidence) {
  assert(!isExample, "real staging evidence file is provided");
  assert(environment.source !== "example-template", "real staging evidence does not use the example source");
  assert(!/Example only/i.test(String(evidence.notes || "")), "real staging evidence notes are not the example note");
}

console.log(JSON.stringify({
  ok: true,
  mode: isExample ? "example-template" : "staging-evidence",
  evidencePath,
  checks,
  summary: {
    apiBaseUrl: environment.apiBaseUrl,
    storageMode: storage.mode,
    postgresStatus: storage.postgresStatus,
    missingTables: storage.missingTables,
    enforcement: accessControl.enforcement,
    liveExecutionClosed: evidence.checks?.liveExecutionClosed === true,
    realEvidenceRequired: requireRealEvidence
  }
}, null, 2));

function assertValidApiBaseUrl(value) {
  assert(typeof value === "string" && value.length > 0, "API base URL is recorded");
  const url = new URL(value);
  assert(url.protocol === "https:" || url.hostname.startsWith("10.") || url.hostname.startsWith("192.168."), "API base URL is staging HTTPS or local LAN");
}

function assertValidIsoDate(value, label) {
  assert(typeof value === "string" && !Number.isNaN(Date.parse(value)), label);
}

function assertNoRawSecrets(text, file) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /DATABASE_URL\s*[:=]\s*["']?postgres(?:ql)?:\/\//i,
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/
  ];

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`HWallet staging evidence smoke failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet staging evidence smoke failed: ${label}`);
  checks.push(label);
}
