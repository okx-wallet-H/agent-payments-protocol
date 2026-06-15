import { readFile } from "node:fs/promises";

await loadLocalEnv();

const baseUrl = readBaseUrl();
const checks = [];
const health = await getJson("/api/v2/system/storage");

check(health.service === "hwallet-v2", "storage health returns HWallet v2 service");
check(health.sessionStore?.mode === "postgres", "staging HWallet session store is postgres");
check(health.sessionStore?.activeWritePath === "postgres", "staging active write path is postgres");
check(health.sessionStore?.productionReady === true, "staging postgres mode is production-ready");
check(health.postgres?.configured === true, "staging postgres is configured");
check(health.postgres?.checked === true, "staging postgres readiness is checked");
check(health.postgres?.status === "ready", "staging postgres health is ready");
check(health.postgres?.missingTables?.length === 0, "staging postgres has no missing HWallet tables");
check(!JSON.stringify(health).includes("postgresql://"), "storage health does not expose postgres connection strings");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checkedAt: health.checkedAt,
  checks,
  storage: {
    mode: health.sessionStore.mode,
    activeWritePath: health.sessionStore.activeWritePath,
    productionReady: health.sessionStore.productionReady,
    postgresStatus: health.postgres.status,
    expectedTables: health.postgres.expectedTables,
    presentTables: health.postgres.presentTables,
    missingTables: health.postgres.missingTables.length,
    warnings: health.warnings.length
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
    throw new Error("Staging storage summary requires HTTPS. Set ALLOW_INSECURE_STAGING_SERVER=true only for temporary LAN tests.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));
  check(response.ok, "storage health endpoint responds with 2xx");
  return data;
}

function check(condition, label) {
  if (!condition) throw new Error(`Staging storage summary smoke failed: ${label}`);
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
