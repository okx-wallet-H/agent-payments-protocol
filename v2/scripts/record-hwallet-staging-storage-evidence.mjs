import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

await loadLocalEnv();

const outputPath = process.env.HWALLET_STAGING_STORAGE_EVIDENCE_FILE || ".tmp/hwallet-staging-storage-evidence.json";
const baseUrl = readBaseUrl();
const checkedAt = new Date().toISOString();

const storage = await getJson("/api/v2/system/storage", "storage");
assert(storage.service === "hwallet-v2", "storage endpoint returns HWallet v2 service");
assert(storage.sessionStore?.mode === "postgres", "staging storage is postgres");
assert(storage.sessionStore?.activeWritePath === "postgres", "staging active write path is postgres");
assert(storage.sessionStore?.productionReady === true, "staging postgres store is production-ready");
assert(storage.postgres?.status === "ready", "staging postgres is ready");
assert((storage.postgres?.missingTables || []).length === 0, "staging postgres has no missing tables");

const auth = await getJson("/api/system/auth", "auth");
assert(auth.accessControl?.requireOwner === true, "owner guard is enabled");
assert(auth.accessControl?.requirePrivyToken === true, "Privy token is required");
assert(auth.accessControl?.enforcement === "privy_access_token", "auth enforcement uses Privy token");

const execution = await getJson("/api/system/execution", "execution");
assert(execution.execution?.canBroadcastTransactions === false, "transaction broadcast is closed");
assert(execution.execution?.realExecutionEnabled === false, "Agent real execution is closed");
assert(execution.execution?.onchainOsLiveMode === false, "Onchain OS live mode is closed");
assert(execution.execution?.polymarketLiveMode === false, "prediction trading live mode is closed");
assert(execution.execution?.publicTradingApiConfigured === false, "public trading API execution is closed");

const protectedProbe = await fetchJson("/api/v2/mobile/wallet?userId=staging-evidence-probe");
assert(protectedProbe.response.status === 401, "protected mobile wallet endpoint requires a Privy token");
assert(protectedProbe.data?.error === "Missing Privy access token", "protected endpoint returns expected missing-token code");

const evidence = {
  kind: "hwallet-staging-storage-evidence",
  version: 1,
  environment: {
    apiBaseUrl: baseUrl,
    checkedAt,
    source: "record-script"
  },
  storage: {
    service: storage.service,
    mode: storage.sessionStore.mode,
    activeWritePath: storage.sessionStore.activeWritePath,
    productionReady: storage.sessionStore.productionReady,
    postgresStatus: storage.postgres.status,
    expectedTables: storage.postgres.expectedTables,
    presentTables: storage.postgres.presentTables,
    missingTables: storage.postgres.missingTables.length,
    warnings: (storage.warnings || []).length
  },
  accessControl: {
    requireOwner: auth.accessControl.requireOwner,
    requirePrivyToken: auth.accessControl.requirePrivyToken,
    enforcement: auth.accessControl.enforcement
  },
  execution: {
    canBroadcastTransactions: execution.execution.canBroadcastTransactions,
    realExecutionEnabled: execution.execution.realExecutionEnabled,
    onchainOsLiveMode: execution.execution.onchainOsLiveMode,
    predictionTradingLiveMode: execution.execution.polymarketLiveMode,
    publicTradingApiConfigured: execution.execution.publicTradingApiConfigured
  },
  protectedProbe: {
    mobileWalletRejectsMissingToken: true,
    errorCode: protectedProbe.data.error
  },
  checks: {
    storageEndpointHealthy: true,
    authEndpointHealthy: true,
    executionEndpointHealthy: true,
    postgresReady: true,
    allTablesPresent: true,
    authRequired: true,
    ownerGuardEnabled: true,
    liveExecutionClosed: true,
    protectedEndpointRequiresToken: true,
    containsNoSecrets: true
  },
  notes:
    process.env.HWALLET_STAGING_STORAGE_EVIDENCE_NOTES ||
    "Recorded from staging system endpoints. Evidence contains no secrets, tokens, database URLs, private keys, or user data."
};

assertNoRawSecrets(JSON.stringify(evidence), outputPath);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
assertGitIgnored(outputPath);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  summary: {
    apiBaseUrl: evidence.environment.apiBaseUrl,
    checkedAt: evidence.environment.checkedAt,
    storageMode: evidence.storage.mode,
    activeWritePath: evidence.storage.activeWritePath,
    postgresStatus: evidence.storage.postgresStatus,
    missingTables: evidence.storage.missingTables,
    enforcement: evidence.accessControl.enforcement,
    liveExecutionClosed: evidence.checks.liveExecutionClosed
  },
  nextSteps: [
    `HWALLET_STAGING_STORAGE_EVIDENCE_FILE=${outputPath} HWALLET_STAGING_STORAGE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-staging-evidence`,
    "Keep the generated file local and ignored. Do not commit real staging evidence."
  ]
}, null, 2));

function readBaseUrl() {
  const value = process.env.STAGING_API_BASE_URL ||
    process.env.AGENT_WALLET_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "https://app.hwallet.vip";
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && process.env.ALLOW_INSECURE_STAGING_SERVER !== "true") {
    throw new Error("HWallet staging evidence requires HTTPS. Set ALLOW_INSECURE_STAGING_SERVER=true only for temporary LAN tests.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function getJson(path, label) {
  const { response, data } = await fetchJson(path);
  assert(response.ok, `${label} endpoint responds with 2xx`);
  return data;
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before recording real staging evidence.`);
  }
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
      throw new Error(`HWallet staging evidence recorder failed: ${file} must not contain raw secret material`);
    }
  }
}

async function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(`HWallet staging evidence recorder failed: ${message}`);
}
