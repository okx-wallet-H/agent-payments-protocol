import { readFile } from "node:fs/promises";

await loadLocalEnv();

const baseUrl = readBaseUrl();
const checks = [];

const storage = await getJson("/api/v2/system/storage", "storage health");
check(storage.service === "hwallet-v2", "storage health returns HWallet v2 service");
check(storage.sessionStore?.mode === "postgres", "server HWallet store is postgres-only");
check(storage.sessionStore?.activeWritePath === "postgres", "server active write path is postgres");
check(storage.sessionStore?.productionReady === true, "server postgres storage is production ready");
check(storage.postgres?.status === "ready", "server postgres schema is ready");
check((storage.postgres?.missingTables || []).length === 0, "server has all HWallet postgres tables");

const auth = await getJson("/api/system/auth", "auth gate");
check(auth.accessControl?.requireOwner === true, "owner guard is enabled");
check(auth.accessControl?.requirePrivyToken === true, "Privy access token is required");
check(auth.accessControl?.enforcement === "privy_access_token", "auth enforcement is Privy token based");

const execution = await getJson("/api/system/execution", "execution gate");
check(execution.execution?.canBroadcastTransactions === false, "live transaction broadcast is closed");
check(execution.execution?.realExecutionEnabled === false, "Agent real execution is closed");
check(execution.execution?.onchainOsLiveMode === false, "Onchain OS live mode is closed");
check(execution.execution?.polymarketLiveMode === false, "prediction trading live mode is closed");
check(execution.execution?.publicTradingApiConfigured === false, "public trading API execution is closed");

const protectedProbe = await fetchJson("/api/v2/mobile/wallet?userId=staging-server-smoke");
check(protectedProbe.response.status === 401, "protected mobile wallet API rejects missing Privy token");
check(
  protectedProbe.data?.error === "Missing Privy access token",
  "protected mobile wallet API returns the expected auth error"
);

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checks,
  storage: {
    mode: storage.sessionStore?.mode,
    activeWritePath: storage.sessionStore?.activeWritePath,
    postgresStatus: storage.postgres?.status,
    missingTables: storage.postgres?.missingTables?.length || 0
  },
  accessControl: {
    enforcement: auth.accessControl?.enforcement,
    requireOwner: auth.accessControl?.requireOwner,
    requirePrivyToken: auth.accessControl?.requirePrivyToken
  },
  execution: {
    canBroadcastTransactions: execution.execution?.canBroadcastTransactions,
    paperModeDefault: execution.execution?.paperModeDefault
  }
}, null, 2));

function readBaseUrl() {
  const value = process.env.STAGING_API_BASE_URL ||
    process.env.AGENT_WALLET_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "";
  if (!value) {
    throw new Error("STAGING_API_BASE_URL, AGENT_WALLET_BASE_URL, or EXPO_PUBLIC_API_BASE_URL is required.");
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && process.env.ALLOW_INSECURE_STAGING_SERVER !== "true") {
    throw new Error("Staging server URL must use HTTPS. Set ALLOW_INSECURE_STAGING_SERVER=true only for temporary LAN tests.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function getJson(path, label) {
  const { response, data } = await fetchJson(path);
  check(response.ok, `${label} endpoint responds with 2xx`);
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

function check(condition, label) {
  if (!condition) throw new Error(`Staging server smoke failed: ${label}`);
  checks.push(label);
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
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
