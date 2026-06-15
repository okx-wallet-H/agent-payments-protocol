import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live HWallet dual consistency smoke.");
  process.exit(1);
}

const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `hwallet-dual-consistency-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";
const idempotencyKey = `dual-consistency-track-${userId}`;
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "agent-wallet-dual-consistency",
  marketId: `agent-wallet-dual-consistency-${userId}`,
  question: "Agent Wallet dual consistency sample",
  status: "active",
  marketType: "binary",
  yesPrice: 0.61,
  noPrice: 0.39,
  acceptingOrders: true,
  liquidity: 188000,
  volume24h: 12600,
  raw: {
    source: "dual consistency smoke"
  }
};

try {
  const health = await getJson("/api/v2/system/storage");
  assert(health.service === "hwallet-v2", "storage health returns v2 service");
  assert(health.sessionStore?.mode === "dual", "server is running in dual mode");
  assert(health.sessionStore?.activeWritePath === "jsonl+postgres", "dual write path is jsonl+postgres");
  assert(health.postgres?.status === "ready", "postgres health is ready");

  await getJson(
    `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`
  );
  await postJson("/api/v2/phase-one", {
    userId,
    walletAddress,
    text: "我要充值"
  });
  await postJson("/api/v2/mobile/wallet/verify-tx", {
    userId,
    walletAddress,
    txHash
  });
  const tracking = await postJson("/api/v2/phase-one/actions", {
    userId,
    action: "track",
    market,
    idempotencyKey
  });
  const duplicateTracking = await postJson("/api/v2/phase-one/actions", {
    userId,
    action: "track",
    market,
    idempotencyKey
  });

  assert(tracking.record?.id, "tracking action created a record");
  assert(duplicateTracking.record?.id === tracking.record.id, "tracking idempotency returns the same record");

  const jsonlSnapshot = await readJsonlSnapshot(userId, tracking.record.id);
  const postgresSnapshot = await readPostgresSnapshot(userId, tracking.record.id);
  const otherJsonlSnapshot = await readJsonlSnapshot(otherUserId, tracking.record.id);
  const otherPostgresSnapshot = await readPostgresSnapshot(otherUserId, tracking.record.id);

  assert(sameAddress(jsonlSnapshot.walletAddress, postgresSnapshot.walletAddress), "wallet address matches both stores");
  assert(jsonlSnapshot.rechargeMessageCount > 0, "jsonl has recharge user message");
  assert(postgresSnapshot.rechargeMessageCount > 0, "postgres has recharge user message");
  assert(jsonlSnapshot.agentMessageCount > 0, "jsonl has Agent reply");
  assert(postgresSnapshot.agentMessageCount > 0, "postgres has Agent reply");
  assert(jsonlSnapshot.verifiedTxCount === 1, "jsonl has exactly one verified tx");
  assert(postgresSnapshot.verifiedTxCount === 1, "postgres has exactly one verified tx");
  assert(jsonlSnapshot.walletTxRecordCount === 1, "jsonl has wallet tx record");
  assert(postgresSnapshot.walletTxRecordCount === 1, "postgres has wallet tx record");
  assert(jsonlSnapshot.trackingRecordCount === 1, "jsonl has one tracking record");
  assert(postgresSnapshot.trackingRecordCount === 1, "postgres has one tracking record");
  assert(jsonlSnapshot.trackingRecordTitle === postgresSnapshot.trackingRecordTitle, "tracking title matches");
  assert(jsonlSnapshot.txAuditCount === 1, "jsonl has one tx audit event");
  assert(postgresSnapshot.txAuditCount === 1, "postgres has one tx audit event");
  assert(jsonlSnapshot.trackingAuditCount === 1, "jsonl has one tracking audit event");
  assert(postgresSnapshot.trackingAuditCount === 1, "postgres has one tracking audit event");
  assert(postgresSnapshot.moneyMovedRows === 0, "postgres audit confirms no money movement");
  assert(jsonlSnapshot.knowledgeNoteCount > 0, "jsonl has knowledge notes");
  assert(postgresSnapshot.knowledgeNoteCount > 0, "postgres has knowledge notes");

  assert(!otherJsonlSnapshot.walletAddress, "other user has no jsonl wallet");
  assert(!otherPostgresSnapshot.walletAddress, "other user has no postgres wallet");
  assert(otherJsonlSnapshot.trackingRecordCount === 0, "other user has no jsonl records");
  assert(otherPostgresSnapshot.trackingRecordCount === 0, "other user has no postgres records");
  assert(otherJsonlSnapshot.txAuditCount === 0, "other user has no jsonl audit");
  assert(otherPostgresSnapshot.txAuditCount === 0, "other user has no postgres audit");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    userId,
    checks: [
      "storage health confirms dual mode",
      "API writes wallet, recharge, tx verification, and tracking action",
      "tracking idempotency is stable",
      "JSONL and Postgres wallet addresses match",
      "JSONL and Postgres both contain recharge chat",
      "JSONL and Postgres both contain verified transfer",
      "JSONL and Postgres both contain wallet record",
      "JSONL and Postgres tracking record counts match",
      "JSONL and Postgres tracking titles match",
      "JSONL and Postgres audit events match",
      "Postgres audit keeps money_moved=false",
      "JSONL and Postgres both contain knowledge notes",
      "other user stays isolated in both stores"
    ],
    jsonl: jsonlSnapshot,
    postgres: postgresSnapshot
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = any($1)", [[userId, otherUserId]]).catch(() => undefined);
  await pool.end().catch(() => undefined);
}

async function readJsonlSnapshot(userId, recordId) {
  const session = (await readJsonlFile("user-sessions.jsonl"))
    .filter((item) => item.userId === userId)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0];
  const records = (await readJsonlFile("phase-one-records.jsonl")).filter((item) => item.userId === userId);
  const audit = (await readJsonlFile("audit-timeline.jsonl")).filter((item) => item.userId === userId);

  return {
    walletAddress: normalizeAddress(session?.walletAddress),
    rechargeMessageCount: (session?.recentMessages || []).filter(
      (message) => message.role === "user" && String(message.text || "").includes("我要充值")
    ).length,
    agentMessageCount: (session?.recentMessages || []).filter((message) => message.role === "agent").length,
    verifiedTxCount: (session?.verifiedWalletTransfers || []).filter(
      (transfer) => normalizeHash(transfer.txHash) === normalizeHash(txHash)
    ).length,
    walletTxRecordCount: (session?.walletRecords || []).filter(
      (record) => String(record.id || "").toLowerCase() === `wallet-tx-${normalizeHash(txHash)}`
    ).length,
    trackingRecordCount: records.filter((record) => record.id === recordId && record.idempotencyKey === idempotencyKey)
      .length,
    trackingRecordTitle: records.find((record) => record.id === recordId)?.title || "",
    txAuditCount: audit.filter((event) => normalizeHash(event.txHash) === normalizeHash(txHash)).length,
    trackingAuditCount: audit.filter((event) => event.type === "tracking.saved" && event.recordId === recordId).length,
    knowledgeNoteCount: (session?.knowledgeNotes || []).length
  };
}

async function readPostgresSnapshot(userId, recordId) {
  const result = await pool.query(
    [
      "select",
      "(select lower(address) from hwallet_wallets where user_id = $1 and chain_id = 196 order by updated_at desc limit 1) as wallet_address,",
      "(select count(*)::int from hwallet_agent_messages where user_id = $1 and role = 'user' and content like '%我要充值%') as recharge_message_count,",
      "(select count(*)::int from hwallet_agent_messages where user_id = $1 and role = 'agent') as agent_message_count,",
      "(select count(*)::int from hwallet_wallet_transfers where user_id = $1 and lower(tx_hash) = lower($2)) as verified_tx_count,",
      "(select count(*)::int from hwallet_agent_records where user_id = $1 and idempotency_key = $4) as wallet_tx_record_count,",
      "(select count(*)::int from hwallet_agent_records where user_id = $1 and id = $3 and idempotency_key = $5) as tracking_record_count,",
      "(select title from hwallet_agent_records where user_id = $1 and id = $3 limit 1) as tracking_record_title,",
      "(select count(*)::int from hwallet_audit_events where user_id = $1 and lower(tx_hash) = lower($2)) as tx_audit_count,",
      "(select count(*)::int from hwallet_audit_events where user_id = $1 and type = 'tracking.saved' and metadata->>'recordId' = $6) as tracking_audit_count,",
      "(select count(*)::int from hwallet_audit_events where user_id = $1 and money_moved <> false) as money_moved_rows,",
      "(select count(*)::int from hwallet_agent_memory_items where user_id = $1 and memory_type = 'knowledge_note') as knowledge_note_count"
    ].join(" "),
    [userId, txHash, recordId, `wallet-record:wallet-tx-${normalizeHash(txHash)}`, idempotencyKey, String(recordId)]
  );
  const row = result.rows[0] || {};
  return {
    walletAddress: normalizeAddress(row.wallet_address),
    rechargeMessageCount: Number(row.recharge_message_count || 0),
    agentMessageCount: Number(row.agent_message_count || 0),
    verifiedTxCount: Number(row.verified_tx_count || 0),
    walletTxRecordCount: Number(row.wallet_tx_record_count || 0),
    trackingRecordCount: Number(row.tracking_record_count || 0),
    trackingRecordTitle: typeof row.tracking_record_title === "string" ? row.tracking_record_title : "",
    txAuditCount: Number(row.tx_audit_count || 0),
    trackingAuditCount: Number(row.tracking_audit_count || 0),
    moneyMovedRows: Number(row.money_moved_rows || 0),
    knowledgeNoteCount: Number(row.knowledge_note_count || 0)
  };
}

async function readJsonlFile(fileName) {
  const file = path.join(process.cwd(), ".agent-wallet-data", fileName);
  const raw = await readFile(file, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function getJson(route) {
  const response = await fetch(`${baseUrl}${route}`);
  return readJsonResponse(response, route);
}

async function postJson(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return readJsonResponse(response, route);
}

async function readJsonResponse(response, route) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${route} failed: ${response.status} ${data.error || data.message || ""}`.trim());
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

function sameAddress(left, right) {
  return Boolean(left && right && left === right);
}

function normalizeAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : undefined;
}

function normalizeHash(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function assert(condition, label) {
  if (!condition) throw new Error(`Live HWallet dual consistency smoke failed: ${label}`);
}
