import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { getHWalletSessionStoreMode } from "./hwallet-postgres-session-store";
import { createPostgresClientOptions } from "./postgres-client-options";

export type AuditTimelineEventType =
  | "wallet.refresh"
  | "wallet.tx_verified"
  | "prediction.analyzed"
  | "tracking.saved"
  | "strategy.saved"
  | "simulation.completed"
  | "policy.blocked";

export interface AuditTimelineEvent {
  id: string;
  userId: string;
  type: AuditTimelineEventType;
  title: string;
  note: string;
  status: "success" | "blocked" | "info";
  moneyMoved: false;
  marketId?: string;
  marketTitle?: string;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  chainId?: number;
  assetSymbol?: string;
  amountLabel?: string;
  tokenAddress?: `0x${string}`;
  simulationSide?: string;
  simulationShares?: string;
  simulationPrice?: string;
  recordId?: string;
  walletRecordId?: string;
  createdAt: string;
}

type AuditTimelineEventInput = Omit<AuditTimelineEvent, "id" | "createdAt" | "moneyMoved"> & {
  moneyMoved?: false;
};

const dataDir = path.join(process.cwd(), ".agent-wallet-data");
const auditFile = path.join(dataDir, "audit-timeline.jsonl");
let auditPool: Pool | undefined;

export async function saveAuditTimelineEvent(input: AuditTimelineEventInput): Promise<AuditTimelineEvent> {
  const event: AuditTimelineEvent = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    moneyMoved: false,
    ...input
  };

  const storeMode = getHWalletSessionStoreMode();
  if (storeMode !== "postgres") {
    await mkdir(dataDir, { recursive: true });
    await appendFile(auditFile, `${JSON.stringify(event)}\n`, "utf8");
  }
  if (storeMode !== "jsonl") {
    await saveAuditTimelineEventToPostgres(event);
  }
  return event;
}

export async function listAuditTimelineEvents(userId: string, limit = 30): Promise<AuditTimelineEvent[]> {
  if (getHWalletSessionStoreMode() === "postgres") {
    return listAuditTimelineEventsFromPostgres(userId, limit);
  }
  return listAuditTimelineEventsFromJsonl(userId, limit);
}

async function listAuditTimelineEventsFromJsonl(userId: string, limit = 30): Promise<AuditTimelineEvent[]> {
  const raw = await readFile(auditFile, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => withAuditDefaults(JSON.parse(line) as Partial<AuditTimelineEvent>))
    .filter((event) => event.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

async function saveAuditTimelineEventToPostgres(event: AuditTimelineEvent): Promise<void> {
  const metadata = {
    recordId: event.recordId,
    walletRecordId: event.walletRecordId,
    tokenAddress: event.tokenAddress,
    simulationSide: event.simulationSide,
    simulationShares: event.simulationShares,
    simulationPrice: event.simulationPrice
  };
  const db = getAuditPool();
  await db.query(
    [
      "insert into app_users (id, created_at, updated_at)",
      "values ($1,$2,$2)",
      "on conflict (id) do update set updated_at = greatest(app_users.updated_at, excluded.updated_at)"
    ].join(" "),
    [event.userId, event.createdAt]
  );
  await db.query(
    [
      "insert into hwallet_audit_events",
      "(id, user_id, type, title, note, status, money_moved, market_id, market_title, tx_hash, explorer_url, chain_id, asset_symbol, amount_label, metadata, created_at)",
      "values ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
      "on conflict (id) do update set",
      "title = excluded.title,",
      "note = excluded.note,",
      "status = excluded.status,",
      "market_id = excluded.market_id,",
      "market_title = excluded.market_title,",
      "tx_hash = excluded.tx_hash,",
      "explorer_url = excluded.explorer_url,",
      "chain_id = excluded.chain_id,",
      "asset_symbol = excluded.asset_symbol,",
      "amount_label = excluded.amount_label,",
      "metadata = excluded.metadata"
    ].join(" "),
    [
      event.id,
      event.userId,
      event.type,
      event.title,
      event.note,
      event.status,
      event.marketId || null,
      event.marketTitle || null,
      event.txHash || null,
      event.explorerUrl || null,
      event.chainId || null,
      event.assetSymbol || null,
      event.amountLabel || null,
      JSON.stringify(metadata),
      event.createdAt
    ]
  );
}

async function listAuditTimelineEventsFromPostgres(userId: string, limit = 30): Promise<AuditTimelineEvent[]> {
  const result = await getAuditPool().query(
    [
      "select id, user_id, type, title, note, status, market_id, market_title, tx_hash, explorer_url,",
      "chain_id, asset_symbol, amount_label, metadata, created_at",
      "from hwallet_audit_events",
      "where user_id = $1",
      "order by created_at desc",
      "limit $2"
    ].join(" "),
    [userId, limit]
  );

  return result.rows.map((row: HWalletAuditRow) => {
    const metadata = readMetadata(row.metadata);
    return withAuditDefaults({
      id: String(row.id || ""),
      userId: String(row.user_id || userId),
      type: String(row.type || "") as AuditTimelineEventType,
      title: String(row.title || ""),
      note: String(row.note || ""),
      status: String(row.status || "") as AuditTimelineEvent["status"],
      marketId: typeof row.market_id === "string" ? row.market_id : undefined,
      marketTitle: typeof row.market_title === "string" ? row.market_title : undefined,
      txHash: normalizeTxHash(row.tx_hash),
      explorerUrl: typeof row.explorer_url === "string" ? row.explorer_url : undefined,
      chainId: typeof row.chain_id === "number" ? row.chain_id : undefined,
      assetSymbol: typeof row.asset_symbol === "string" ? row.asset_symbol : undefined,
      amountLabel: typeof row.amount_label === "string" ? row.amount_label : undefined,
      tokenAddress: normalizeWalletAddress(metadata.tokenAddress),
      simulationSide: readString(metadata.simulationSide),
      simulationShares: readString(metadata.simulationShares),
      simulationPrice: readString(metadata.simulationPrice),
      recordId: readString(metadata.recordId),
      walletRecordId: readString(metadata.walletRecordId),
      createdAt: toIso(row.created_at)
    });
  });
}

function withAuditDefaults(input: Partial<AuditTimelineEvent>): AuditTimelineEvent {
  return {
    id: input.id || crypto.randomUUID(),
    userId: input.userId || "demo-user",
    type: input.type || "prediction.analyzed",
    title: input.title || "Agent 记录",
    note: input.note || "",
    status: input.status || "info",
    moneyMoved: false,
    marketId: input.marketId,
    marketTitle: input.marketTitle,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    chainId: input.chainId,
    assetSymbol: input.assetSymbol,
    amountLabel: input.amountLabel,
    tokenAddress: input.tokenAddress,
    simulationSide: input.simulationSide,
    simulationShares: input.simulationShares,
    simulationPrice: input.simulationPrice,
    recordId: input.recordId,
    walletRecordId: input.walletRecordId,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function getAuditPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("HWALLET_SESSION_STORE requires DATABASE_URL before using the Postgres audit timeline store.");
  }
  auditPool ||= new Pool(createPostgresClientOptions(databaseUrl));
  return auditPool;
}

function readMetadata(value: unknown): Record<string, unknown> {
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
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

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

interface HWalletAuditRow {
  id?: unknown;
  user_id?: unknown;
  type?: unknown;
  title?: unknown;
  note?: unknown;
  status?: unknown;
  market_id?: unknown;
  market_title?: unknown;
  tx_hash?: unknown;
  explorer_url?: unknown;
  chain_id?: unknown;
  asset_symbol?: unknown;
  amount_label?: unknown;
  metadata?: unknown;
  created_at?: unknown;
}
