import { readFile } from "node:fs/promises";

await loadLocalEnv();

const mode = process.env.STAGING_READINESS === "true" || process.env.PRODUCTION_READINESS === "true"
  ? "staging"
  : "local";
const checks = [];
const warnings = [];

const { getAccessControlStatus } = await import("../../lib/access-control.ts");
const { getExecutionGateStatus } = await import("../../lib/execution-gates.ts");
const { readV2StorageHealth } = await import("../storage/storage-health.ts");

const access = getAccessControlStatus();
const execution = getExecutionGateStatus();
const storage = await readV2StorageHealth({
  checkPostgres: mode === "staging"
});

check(!execution.canBroadcastTransactions, "live transaction broadcast gates are closed");
check(process.env.AGENT_WALLET_REAL_EXECUTION !== "true", "Agent real execution switch is closed");
check(process.env.ONCHAINOS_LIVE_MODE !== "true", "Onchain OS live mode is closed");
check(process.env.POLYMARKET_LIVE_MODE !== "true", "prediction trading live mode is closed");
check(process.env.POLYMARKET_TRADING_API_ENABLED !== "true", "public trading API execution is closed");
check(storage.service === "hwallet-v2", "V2 storage health is reachable");
check(storage.postgres.status !== "error", "V2 storage health has no Postgres error");

if (mode === "local") {
  if (storage.sessionStore.mode !== "jsonl") {
    warnings.push(`Local readiness is running with HWALLET_SESSION_STORE=${storage.sessionStore.mode}.`);
  }
  if (!access.requirePrivyToken) {
    warnings.push("Local readiness allows userId fallback; staging must require Privy Bearer tokens.");
  }
} else {
  check(process.env.NODE_ENV === "production" || process.env.AGENT_REQUIRE_PRIVY_TOKEN === "true", "Privy Bearer token is required");
  check(process.env.AGENT_REQUIRE_OWNER === "true", "owner guard is enabled");
  check(Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.EXPO_PUBLIC_PRIVY_APP_ID), "Privy app id is configured");
  check(Boolean(process.env.PRIVY_APP_SECRET), "Privy app secret is configured");
  check(Boolean(process.env.DATABASE_URL), "DATABASE_URL is configured");
  check(storage.sessionStore.mode === "postgres", "HWallet store is postgres-only");
  check(storage.sessionStore.productionReady === true, "HWallet postgres storage is production ready");
  check(storage.postgres.status === "ready", "Postgres schema is ready");
  check(storage.postgres.missingTables.length === 0, "Postgres has all HWallet tables");
  check(Boolean(process.env.EXPO_PUBLIC_API_BASE_URL), "mobile API base URL is configured");
}

console.log(JSON.stringify({
  ok: true,
  mode,
  checks,
  warnings,
  storage: {
    mode: storage.sessionStore.mode,
    activeWritePath: storage.sessionStore.activeWritePath,
    postgresStatus: storage.postgres.status,
    productionReady: storage.sessionStore.productionReady,
    missingTables: storage.postgres.missingTables.length
  },
  accessControl: {
    enforcement: access.enforcement,
    authProvider: access.authProvider,
    requireOwner: access.requireOwner,
    requirePrivyToken: access.requirePrivyToken,
    warningCount: access.warnings.length
  },
  execution: {
    canBroadcastTransactions: execution.canBroadcastTransactions,
    paperModeDefault: execution.paperModeDefault
  }
}, null, 2));

function check(condition, label) {
  if (!condition) throw new Error(`Production readiness smoke failed: ${label}`);
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
