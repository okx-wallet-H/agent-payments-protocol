import { Pool, type PoolClient } from "pg";
import type { AgentWalletAssetSymbol, AgentWalletRecord } from "../wallet/wallet-orchestrator";
import { createPostgresClientOptions } from "./postgres-client-options";
import type { UserSessionMemory, UserSessionVerifiedWalletTransfer } from "./user-session-store";

export type HWalletSessionStoreMode = "jsonl" | "dual" | "postgres";
type PgQueryable = Pick<Pool, "query">;

let pool: Pool | undefined;

export function getHWalletSessionStoreMode(): HWalletSessionStoreMode {
  const rawMode = (process.env.HWALLET_SESSION_STORE || process.env.HWALLET_STORE || "jsonl")
    .trim()
    .toLowerCase();

  if (rawMode === "dual" || rawMode === "postgres") return rawMode;
  return "jsonl";
}

export async function writeUserSessionToPostgres(memory: UserSessionMemory): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await upsertAppUser(client, memory.userId, memory.firstSeenAt, memory.updatedAt);
    const walletId = memory.walletAddress ? await upsertWallet(client, memory) : undefined;
    const sessionId = await upsertActiveSession(client, memory);

    if (walletId) {
      await upsertWalletAssets(client, walletId, memory);
      await upsertWalletTransfers(client, walletId, memory.userId, memory.verifiedWalletTransfers);
    }

    await insertRecentMessages(client, sessionId, memory);
    await upsertWalletRecords(client, sessionId, memory);
    await insertKnowledgeNotes(client, sessionId, memory);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadUserSessionFromPostgres(userId: string): Promise<UserSessionMemory | undefined> {
  const client = await getPool().connect();
  try {
    const userResult = await client.query("select id, created_at, updated_at from app_users where id = $1", [userId]);
    const walletResult = await client.query(
      [
        "select id, address, chain_id, network, created_at, updated_at",
        "from hwallet_wallets",
        "where user_id = $1 and chain_id = 196 and status <> 'revoked'",
        "order by updated_at desc",
        "limit 1"
      ].join(" "),
      [userId]
    );
    const sessionResult = await client.query(
      [
        "select id, last_orchestration, created_at, updated_at",
        "from hwallet_agent_sessions",
        "where user_id = $1",
        "order by case when status = 'active' then 0 else 1 end, updated_at desc",
        "limit 1"
      ].join(" "),
      [userId]
    );

    if (userResult.rowCount === 0 && walletResult.rowCount === 0 && sessionResult.rowCount === 0) return undefined;

    const wallet = walletResult.rows[0] as HWalletWalletRow | undefined;
    const session = sessionResult.rows[0] as HWalletSessionRow | undefined;
    const sessionId = session?.id ? String(session.id) : undefined;

    const assets = wallet?.id ? await loadWalletAssetSnapshot(client, String(wallet.id)) : undefined;
    const transfers = wallet?.id ? await loadWalletTransfers(client, userId, String(wallet.id)) : [];
    const messages = sessionId ? await loadRecentMessages(client, userId, sessionId) : [];
    const records = await loadWalletRecords(client, userId);
    const notes = await loadKnowledgeNotes(client, userId);

    const orchestration = readJsonObject(session?.last_orchestration);
    const counters = readCounters(orchestration.counters);
    const now = new Date().toISOString();
    const user = userResult.rows[0] as HWalletUserRow | undefined;

    return {
      userId,
      walletAddress: normalizeWalletAddress(wallet?.address),
      walletChainId: 196,
      walletNetwork: "X Layer",
      walletAssetSnapshot: assets,
      counters,
      recentMessages: messages,
      walletRecords: records,
      verifiedWalletTransfers: transfers,
      knowledgeNotes: notes,
      firstSeenAt: readIso(orchestration.firstSeenAt) || toIso(user?.created_at) || toIso(session?.created_at) || now,
      updatedAt: toIso(session?.updated_at) || toIso(user?.updated_at) || now
    };
  } finally {
    client.release();
  }
}

async function upsertAppUser(
  client: PoolClient,
  userId: string,
  firstSeenAt: string,
  updatedAt: string
): Promise<void> {
  await client.query(
    [
      "insert into app_users (id, created_at, updated_at)",
      "values ($1, $2, $3)",
      "on conflict (id) do update set updated_at = greatest(app_users.updated_at, excluded.updated_at)"
    ].join(" "),
    [userId, firstSeenAt, updatedAt]
  );
}

async function upsertWallet(client: PoolClient, memory: UserSessionMemory): Promise<string> {
  const result = await client.query(
    [
      "insert into hwallet_wallets (user_id, address, chain_id, network, status, source, created_at, updated_at)",
      "values ($1, $2, 196, 'X Layer', 'ready', 'privy_embedded_wallet', $3, $4)",
      "on conflict (user_id, chain_id) do update set",
      "address = excluded.address,",
      "network = excluded.network,",
      "status = 'ready',",
      "source = excluded.source,",
      "updated_at = excluded.updated_at",
      "returning id"
    ].join(" "),
    [memory.userId, memory.walletAddress, memory.firstSeenAt, memory.updatedAt]
  );
  return String(result.rows[0].id);
}

async function upsertWalletAssets(client: PoolClient, walletId: string, memory: UserSessionMemory): Promise<void> {
  const snapshot = memory.walletAssetSnapshot;
  if (!snapshot) return;

  for (const symbol of ["USDT0", "USDT", "OKB"] as const) {
    const amountLabel = snapshot[symbol];
    if (!amountLabel) continue;
    await client.query(
      [
        "insert into hwallet_wallet_assets",
        "(wallet_id, user_id, symbol, name, amount, amount_label, value_label, sync_status, raw_json, last_synced_at, updated_at)",
        "values ($1,$2,$3,$4,$5,$6,'-','synced',$7,$8,$8)",
        "on conflict (wallet_id, symbol) do update set",
        "amount = excluded.amount,",
        "amount_label = excluded.amount_label,",
        "value_label = excluded.value_label,",
        "sync_status = excluded.sync_status,",
        "raw_json = excluded.raw_json,",
        "last_synced_at = excluded.last_synced_at,",
        "updated_at = excluded.updated_at"
      ].join(" "),
      [
        walletId,
        memory.userId,
        symbol,
        getAssetName(symbol),
        toNumericAmount(amountLabel),
        amountLabel,
        JSON.stringify({ source: "user_session", symbol, amountLabel }),
        memory.updatedAt
      ]
    );
  }
}

async function upsertWalletTransfers(
  client: PoolClient,
  walletId: string,
  userId: string,
  transfers: UserSessionVerifiedWalletTransfer[]
): Promise<void> {
  for (const transfer of transfers.slice(0, 30)) {
    await client.query(
      [
        "insert into hwallet_wallet_transfers",
        "(user_id, wallet_id, tx_hash, chain_id, status, asset_symbol, amount, amount_label, token_address, explorer_url, raw_json, verified_at)",
        "values ($1,$2,$3,196,$4,$5,$6,$7,$8,$9,$10,$11)",
        "on conflict (user_id, lower(tx_hash)) do update set",
        "status = excluded.status,",
        "asset_symbol = excluded.asset_symbol,",
        "amount = excluded.amount,",
        "amount_label = excluded.amount_label,",
        "token_address = excluded.token_address,",
        "explorer_url = excluded.explorer_url,",
        "raw_json = excluded.raw_json,",
        "verified_at = excluded.verified_at"
      ].join(" "),
      [
        userId,
        walletId,
        transfer.txHash,
        transfer.status,
        transfer.assetSymbol || null,
        transfer.amountLabel ? toNumericAmount(transfer.amountLabel) : null,
        transfer.amountLabel || null,
        transfer.tokenAddress || null,
        transfer.explorerUrl || null,
        JSON.stringify({ source: "user_session", message: transfer.message }),
        transfer.verifiedAt
      ]
    );
  }
}

async function upsertActiveSession(client: PoolClient, memory: UserSessionMemory): Promise<string> {
  const existing = await client.query(
    [
      "select id from hwallet_agent_sessions",
      "where user_id = $1 and status = 'active'",
      "order by updated_at desc",
      "limit 1"
    ].join(" "),
    [memory.userId]
  );
  const lastOrchestration = JSON.stringify({
    counters: memory.counters,
    firstSeenAt: memory.firstSeenAt,
    updatedAt: memory.updatedAt,
    storeVersion: 1
  });

  if (existing.rowCount) {
    const sessionId = String(existing.rows[0].id);
    await client.query(
      [
        "update hwallet_agent_sessions",
        "set title = 'Agent 会话', last_goal_type = 'wallet_session', last_orchestration = $2, updated_at = $3",
        "where id = $1"
      ].join(" "),
      [sessionId, lastOrchestration, memory.updatedAt]
    );
    return sessionId;
  }

  const created = await client.query(
    [
      "insert into hwallet_agent_sessions",
      "(user_id, title, status, last_goal_type, last_orchestration, created_at, updated_at)",
      "values ($1, 'Agent 会话', 'active', 'wallet_session', $2, $3, $4)",
      "returning id"
    ].join(" "),
    [memory.userId, lastOrchestration, memory.firstSeenAt, memory.updatedAt]
  );
  return String(created.rows[0].id);
}

async function insertRecentMessages(
  client: PoolClient,
  sessionId: string,
  memory: UserSessionMemory
): Promise<void> {
  for (const message of memory.recentMessages.slice(-12)) {
    await client.query(
      [
        "insert into hwallet_agent_messages",
        "(session_id, user_id, role, kind, content, actions_json, created_at)",
        "select $1,$2,$3,'text',$4,'[]'::jsonb,$5",
        "where not exists (",
        "select 1 from hwallet_agent_messages",
        "where session_id = $1 and user_id = $2 and role = $3 and content = $4 and created_at = $5",
        ")"
      ].join(" "),
      [sessionId, memory.userId, message.role, message.text, message.createdAt]
    );
  }
}

async function upsertWalletRecords(
  client: PoolClient,
  sessionId: string,
  memory: UserSessionMemory
): Promise<void> {
  for (const record of memory.walletRecords.slice(0, 40)) {
    await client.query(
      [
        "insert into hwallet_agent_records",
        "(user_id, session_id, idempotency_key, type, title, note, card_json, created_at)",
        "values ($1,$2,$3,'tracking.saved',$4,$5,$6,$7)",
        "on conflict (user_id, idempotency_key) where idempotency_key is not null",
        "do update set",
        "session_id = excluded.session_id,",
        "title = excluded.title,",
        "note = excluded.note,",
        "card_json = excluded.card_json"
      ].join(" "),
      [
        memory.userId,
        sessionId,
        `wallet-record:${record.id}`,
        record.title,
        record.note,
        JSON.stringify(record),
        record.createdAt
      ]
    );
  }
}

async function insertKnowledgeNotes(
  client: PoolClient,
  sessionId: string,
  memory: UserSessionMemory
): Promise<void> {
  for (const note of memory.knowledgeNotes.slice(-20)) {
    await client.query(
      [
        "insert into hwallet_agent_memory_items",
        "(user_id, session_id, memory_type, content, content_json, source, created_at)",
        "select $1,$2,'knowledge_note',$3,$4,'user_session',$5",
        "where not exists (",
        "select 1 from hwallet_agent_memory_items",
        "where user_id = $1 and memory_type = 'knowledge_note' and lower(content) = lower($3)",
        ")"
      ].join(" "),
      [
        memory.userId,
        sessionId,
        note,
        JSON.stringify({ source: "user_session", content: note }),
        memory.updatedAt
      ]
    );
  }
}

async function loadWalletAssetSnapshot(
  db: PgQueryable,
  walletId: string
): Promise<UserSessionMemory["walletAssetSnapshot"] | undefined> {
  const result = await db.query(
    "select symbol, amount_label from hwallet_wallet_assets where wallet_id = $1 order by updated_at desc",
    [walletId]
  );
  const snapshot: UserSessionMemory["walletAssetSnapshot"] = {};
  for (const row of result.rows as Array<{ symbol: string; amount_label: string }>) {
    if (isAssetSymbol(row.symbol)) snapshot[row.symbol] = row.amount_label;
  }
  return Object.keys(snapshot).length ? snapshot : undefined;
}

async function loadWalletTransfers(
  db: PgQueryable,
  userId: string,
  walletId: string
): Promise<UserSessionVerifiedWalletTransfer[]> {
  const result = await db.query(
    [
      "select tx_hash, status, asset_symbol, amount_label, token_address, explorer_url, raw_json, verified_at",
      "from hwallet_wallet_transfers",
      "where user_id = $1 and wallet_id = $2",
      "order by verified_at desc",
      "limit 30"
    ].join(" "),
    [userId, walletId]
  );

  return result.rows
    .map((row: HWalletTransferRow): UserSessionVerifiedWalletTransfer | undefined => {
      const txHash = normalizeTxHash(row.tx_hash);
      if (!txHash || !isTransferStatus(row.status)) return undefined;
      const rawJson = readJsonObject(row.raw_json);
      return {
        txHash,
        status: row.status,
        message: typeof rawJson.message === "string" ? rawJson.message : "转账记录已同步",
        explorerUrl: typeof row.explorer_url === "string" ? row.explorer_url : undefined,
        chainId: 196,
        assetSymbol: isAssetSymbol(row.asset_symbol) ? row.asset_symbol : undefined,
        amountLabel: typeof row.amount_label === "string" ? row.amount_label : undefined,
        tokenAddress: normalizeWalletAddress(row.token_address),
        verifiedAt: toIso(row.verified_at)
      };
    })
    .filter((transfer): transfer is UserSessionVerifiedWalletTransfer => Boolean(transfer));
}

async function loadRecentMessages(
  db: PgQueryable,
  userId: string,
  sessionId: string
): Promise<UserSessionMemory["recentMessages"]> {
  const result = await db.query(
    [
      "select role, content, created_at",
      "from hwallet_agent_messages",
      "where user_id = $1 and session_id = $2 and role in ('user','agent') and content is not null",
      "order by created_at desc",
      "limit 12"
    ].join(" "),
    [userId, sessionId]
  );

  return result.rows
    .map((row: HWalletMessageRow) => {
      const role: "user" | "agent" = row.role === "user" ? "user" : "agent";
      return {
        role,
        text: String(row.content || ""),
        createdAt: toIso(row.created_at)
      };
    })
    .reverse();
}

async function loadWalletRecords(db: PgQueryable, userId: string): Promise<AgentWalletRecord[]> {
  const result = await db.query(
    [
      "select id, idempotency_key, title, note, card_json, created_at",
      "from hwallet_agent_records",
      "where user_id = $1",
      "order by created_at desc",
      "limit 40"
    ].join(" "),
    [userId]
  );

  return result.rows
    .map((row: HWalletRecordRow): AgentWalletRecord | undefined => {
      const card = readJsonObject(row.card_json);
      const status = card.status;
      const idempotencyKey = typeof row.idempotency_key === "string" ? row.idempotency_key : "";
      const recordId = idempotencyKey.startsWith("wallet-record:") ? idempotencyKey.slice("wallet-record:".length) : String(row.id);
      if (!row.title) return undefined;
      return {
        id: recordId,
        title: String(row.title),
        note: String(row.note || ""),
        status: status === "pending" || status === "failed" || status === "synced" ? status : "synced",
        createdAt: toIso(row.created_at)
      };
    })
    .filter((record): record is AgentWalletRecord => Boolean(record));
}

async function loadKnowledgeNotes(db: PgQueryable, userId: string): Promise<string[]> {
  const result = await db.query(
    [
      "select content",
      "from hwallet_agent_memory_items",
      "where user_id = $1 and memory_type = 'knowledge_note'",
      "order by created_at desc",
      "limit 20"
    ].join(" "),
    [userId]
  );
  return result.rows
    .map((row: { content: unknown }) => String(row.content || "").trim())
    .filter(Boolean)
    .reverse();
}

function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("HWALLET_SESSION_STORE requires DATABASE_URL before using the Postgres session store.");
  }
  pool ||= new Pool(createPostgresClientOptions(databaseUrl));
  return pool;
}

function getAssetName(symbol: AgentWalletAssetSymbol): string {
  if (symbol === "USDT0") return "USD Tether 0";
  if (symbol === "USDT") return "Tether USD";
  return "X Layer Gas";
}

function isAssetSymbol(value: unknown): value is AgentWalletAssetSymbol {
  return value === "USDT0" || value === "USDT" || value === "OKB";
}

function isTransferStatus(value: unknown): value is UserSessionVerifiedWalletTransfer["status"] {
  return (
    value === "received" ||
    value === "not_for_wallet" ||
    value === "failed" ||
    value === "not_found" ||
    value === "unsupported_asset"
  );
}

function toNumericAmount(value: string): string {
  const normalized = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0];
  return normalized || "0";
}

function normalizeTxHash(value: unknown): `0x${string}` | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) return undefined;
  return normalized as `0x${string}`;
}

function normalizeWalletAddress(value: unknown): `0x${string}` | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return undefined;
  return normalized as `0x${string}`;
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readCounters(value: unknown): UserSessionMemory["counters"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { homeLoads: 0, chatTurns: 0 };
  }
  const counters = value as Record<string, unknown>;
  return {
    homeLoads: Number(counters.homeLoads || 0),
    chatTurns: Number(counters.chatTurns || 0)
  };
}

function readIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

interface HWalletUserRow {
  created_at?: unknown;
  updated_at?: unknown;
}

interface HWalletWalletRow {
  id?: unknown;
  address?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

interface HWalletSessionRow {
  id?: unknown;
  last_orchestration?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

interface HWalletTransferRow {
  tx_hash?: unknown;
  status?: unknown;
  asset_symbol?: unknown;
  amount_label?: unknown;
  token_address?: unknown;
  explorer_url?: unknown;
  raw_json?: unknown;
  verified_at?: unknown;
}

interface HWalletMessageRow {
  role?: unknown;
  content?: unknown;
  created_at?: unknown;
}

interface HWalletRecordRow {
  id?: unknown;
  idempotency_key?: unknown;
  title?: unknown;
  note?: unknown;
  card_json?: unknown;
  created_at?: unknown;
}
