import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live HWallet dual observation smoke.");
  process.exit(1);
}

const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `hwallet-dual-observe-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";
const trackKey = `observe-track-${userId}`;
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "agent-wallet-observation",
  marketId: `agent-wallet-observation-${userId}`,
  question: "Agent Wallet 观察样本市场",
  status: "active",
  marketType: "binary",
  yesPrice: 0.52,
  noPrice: 0.48,
  acceptingOrders: true,
  liquidity: 120000,
  volume24h: 8600,
  raw: {
    source: "dual observation smoke"
  }
};

try {
  const health = await getJson("/api/v2/system/storage");
  assert(health.service === "hwallet-v2", "storage health returns v2 service");
  assert(health.sessionStore?.mode === "dual", "server is running in dual mode");
  assert(health.postgres?.status === "ready", "postgres health is ready");
  assert(health.postgres?.missingTables?.length === 0, "postgres has all required tables");

  const home = await getJson(
    `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`
  );
  assert(home.wallet?.address === walletAddress, "home binds wallet for current user");

  const recharge = await postJson("/api/v2/phase-one", {
    userId,
    walletAddress,
    text: "我要充值"
  });
  assert(recharge.mobileTurn?.goalType === "wallet_receive", "recharge route returns receive flow");

  const verified = await postJson("/api/v2/mobile/wallet/verify-tx", {
    userId,
    walletAddress,
    txHash
  });
  assert(verified.verification?.txHash === txHash, "wallet tx verification returns hash");

  const tracking = await postJson("/api/v2/phase-one/actions", {
    userId,
    action: "track",
    market,
    idempotencyKey: trackKey
  });
  assert(tracking.record?.type === "tracking.saved", "tracking action returns record");

  const memory = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(userId)}`);
  const audit = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}&limit=20`);
  const records = await getJson(`/api/v2/phase-one/records?userId=${encodeURIComponent(userId)}`);
  const otherMemory = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(otherUserId)}`);
  const otherAudit = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(otherUserId)}&limit=20`);
  const otherRecords = await getJson(`/api/v2/phase-one/records?userId=${encodeURIComponent(otherUserId)}`);

  assert(memory.memory?.wallet?.address === walletAddress, "memory endpoint returns wallet binding");
  assert(
    memory.memory?.wallet?.verifiedTransfers?.some((transfer) => normalizeHex(transfer.txHash) === normalizeHex(txHash)),
    "memory endpoint returns verified transfer"
  );
  assert(memory.memory?.recentMessages?.some((message) => message.text.includes("我要充值")), "memory endpoint returns chat text");
  assert(
    audit.events?.some((event) => normalizeHex(event.txHash) === normalizeHex(txHash)),
    "audit endpoint returns wallet tx event"
  );
  assert(audit.events?.some((event) => event.type === "tracking.saved"), "audit endpoint returns tracking event");
  assert(records.items?.some((record) => record.id === tracking.record.id), "records endpoint returns tracking record");
  assert(!otherMemory.memory?.wallet?.address, "other user memory has no wallet");
  assert((otherAudit.events || []).length === 0, "other user audit stays isolated");
  assert((otherRecords.items || []).length === 0, "other user records stay isolated");

  const dbSnapshot = await readPostgresSnapshot(userId, tracking.record.id);
  assert(dbSnapshot.wallets > 0, "postgres mirrored wallet binding");
  assert(dbSnapshot.transfers > 0, "postgres mirrored verified transfer");
  assert(dbSnapshot.messages > 0, "postgres mirrored chat messages");
  assert(dbSnapshot.auditEvents > 0, "postgres mirrored audit events");
  assert(dbSnapshot.records > 0, "postgres mirrored action record");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    userId,
    checks: [
      "storage health confirms dual mode",
      "home binds wallet",
      "recharge flow returns receive card",
      "wallet tx verification works",
      "tracking action creates record",
      "memory API returns wallet and chat",
      "audit API returns wallet and tracking events",
      "records API returns tracking record",
      "other user stays isolated",
      "postgres mirror contains wallet, transfer, messages, audit, records"
    ]
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = any($1)", [[userId, otherUserId]]).catch(() => undefined);
  await pool.end().catch(() => undefined);
}

async function readPostgresSnapshot(userId, recordId) {
  const result = await pool.query(
    [
      "select",
      "(select count(*)::int from hwallet_wallets where user_id = $1) as wallets,",
      "(select count(*)::int from hwallet_wallet_transfers where user_id = $1 and lower(tx_hash) = lower($2)) as transfers,",
      "(select count(*)::int from hwallet_agent_messages where user_id = $1) as messages,",
      "(select count(*)::int from hwallet_audit_events where user_id = $1) as audit_events,",
      "(select count(*)::int from hwallet_agent_records where user_id = $1 and id = $3) as records"
    ].join(" "),
    [userId, txHash, recordId]
  );
  const row = result.rows[0] || {};
  return {
    wallets: Number(row.wallets || 0),
    transfers: Number(row.transfers || 0),
    messages: Number(row.messages || 0),
    auditEvents: Number(row.audit_events || 0),
    records: Number(row.records || 0)
  };
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

function normalizeHex(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function assert(condition, label) {
  if (!condition) throw new Error(`Live HWallet dual observation smoke failed: ${label}`);
}
