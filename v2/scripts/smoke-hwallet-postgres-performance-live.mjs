import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live HWallet Postgres performance smoke.");
  process.exit(1);
}

const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `hwallet-postgres-perf-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";
const trackKey = `postgres-perf-track-${userId}`;
const maxEndpointMs = readNumberEnv("HWALLET_POSTGRES_PERF_MAX_ENDPOINT_MS", 25_000);
const maxReadEndpointMs = readNumberEnv("HWALLET_POSTGRES_PERF_MAX_READ_ENDPOINT_MS", 10_000);
const maxTotalMs = readNumberEnv("HWALLET_POSTGRES_PERF_MAX_TOTAL_MS", 120_000);
const clientOptions = createPostgresClientOptions(process.env.DATABASE_URL);
const pool = new pg.Pool(clientOptions);

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "agent-wallet-postgres-perf",
  marketId: `agent-wallet-postgres-perf-${userId}`,
  question: "Agent Wallet Postgres 性能样本市场",
  status: "active",
  marketType: "binary",
  yesPrice: 0.52,
  noPrice: 0.48,
  acceptingOrders: true,
  liquidity: 120000,
  volume24h: 8600,
  raw: {
    source: "postgres performance smoke"
  }
};

const timings = [];
const totalStart = performance.now();

try {
  assert(clientOptions.max >= 1 && clientOptions.max <= 5, "postgres pool max stays inside Supabase-safe range");
  assert(clientOptions.connectionTimeoutMillis <= 15_000, "postgres connection timeout remains bounded");

  await measure("postgres.select_1", async () => {
    await pool.query("select 1");
  }, maxReadEndpointMs);

  const health = await measure("api.storage_health", () => getJson("/api/v2/system/storage"), maxReadEndpointMs);
  assert(health.service === "hwallet-v2", "storage health returns v2 service");
  assert(health.sessionStore?.mode === "postgres", "server is running in postgres mode");
  assert(health.sessionStore?.activeWritePath === "postgres", "active write path is postgres");
  assert(health.sessionStore?.productionReady === true, "postgres mode is production ready when tables are present");
  assert(health.postgres?.status === "ready", "postgres health is ready");
  assert(health.postgres?.missingTables?.length === 0, "postgres has all required tables");

  const home = await measure(
    "api.mobile_home_bind_wallet",
    () => getJson(`/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`),
    maxEndpointMs
  );
  assert(sameHex(home.wallet?.address, walletAddress), "home binds wallet through postgres");

  const walletStatus = await measure(
    "api.mobile_wallet_read",
    () => getJson(`/api/v2/mobile/wallet?userId=${encodeURIComponent(userId)}`),
    maxEndpointMs
  );
  assert(sameHex(walletStatus.wallet?.address, walletAddress), "wallet endpoint reads bound wallet from postgres");

  const recharge = await measure(
    "api.chat_recharge",
    () => postJson("/api/v2/phase-one", { userId, text: "我要充值" }),
    maxEndpointMs
  );
  assert(recharge.mobileTurn?.goalType === "wallet_receive", "recharge route reads wallet from postgres");

  const verified = await measure(
    "api.wallet_verify_tx",
    () => postJson("/api/v2/mobile/wallet/verify-tx", { userId, txHash }),
    maxEndpointMs
  );
  assert(verified.verification?.txHash === txHash, "wallet tx verification works through postgres");

  const tracking = await measure(
    "api.track_action",
    () => postJson("/api/v2/phase-one/actions", {
      userId,
      action: "track",
      market,
      idempotencyKey: trackKey
    }),
    maxEndpointMs
  );
  assert(tracking.record?.type === "tracking.saved", "tracking action writes record through postgres");

  const duplicate = await measure(
    "api.track_action_idempotent",
    () => postJson("/api/v2/phase-one/actions", {
      userId,
      action: "track",
      market,
      idempotencyKey: trackKey
    }),
    maxReadEndpointMs
  );
  assert(duplicate.idempotent === true, "tracking idempotency reads existing postgres record");

  const memory = await measure(
    "api.mobile_memory",
    () => getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(userId)}`),
    maxReadEndpointMs
  );
  assert(sameHex(memory.memory?.wallet?.address, walletAddress), "memory endpoint reads wallet from postgres");

  const audit = await measure(
    "api.mobile_audit",
    () => getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}&limit=20`),
    maxReadEndpointMs
  );
  assert(audit.events?.some((event) => normalizeHex(event.txHash) === normalizeHex(txHash)), "audit reads wallet tx event from postgres");

  const records = await measure(
    "api.phase_one_records",
    () => getJson(`/api/v2/phase-one/records?userId=${encodeURIComponent(userId)}`),
    maxReadEndpointMs
  );
  assert(records.items?.some((record) => record.id === tracking.record.id), "records endpoint reads tracking record from postgres");

  const otherMemory = await measure(
    "api.other_user_memory",
    () => getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(otherUserId)}`),
    maxReadEndpointMs
  );
  assert(!otherMemory.memory?.wallet?.address, "other user memory stays isolated");

  const totalMs = Math.round(performance.now() - totalStart);
  assert(totalMs <= maxTotalMs, `postgres performance total should stay <= ${maxTotalMs}ms`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    userId,
    thresholds: {
      maxEndpointMs,
      maxReadEndpointMs,
      maxTotalMs
    },
    pool: {
      max: clientOptions.max,
      idleTimeoutMillis: clientOptions.idleTimeoutMillis,
      connectionTimeoutMillis: clientOptions.connectionTimeoutMillis
    },
    timings,
    totalMs,
    checks: [
      "server postgres mode confirmed",
      "pool settings stay Supabase-safe",
      "core App endpoints stay under live latency thresholds",
      "wallet binding, recharge, tx verification, records, memory, and audit still work",
      "other user remains isolated"
    ]
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = any($1)", [[userId, otherUserId]]).catch(() => undefined);
  await pool.end().catch(() => undefined);
}

async function measure(name, fn, thresholdMs) {
  const startedAt = performance.now();
  const value = await fn();
  const durationMs = Math.round(performance.now() - startedAt);
  timings.push({ name, durationMs, thresholdMs });
  assert(durationMs <= thresholdMs, `${name} should stay <= ${thresholdMs}ms; saw ${durationMs}ms`);
  return value;
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return readJsonResponse(response, path);
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return readJsonResponse(response, path);
}

async function readJsonResponse(response, path) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.error || data.message || ""}`.trim());
  }
  return data;
}

async function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
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

function readNumberEnv(key, fallback) {
  const value = Number(process.env[key] || "");
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function normalizeHex(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function sameHex(left, right) {
  return normalizeHex(left) === normalizeHex(right);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Live HWallet Postgres performance smoke failed: ${label}`);
}
