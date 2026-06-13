import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { MarketSnapshot } from "../domain/types";
import { getHWalletSessionStoreMode } from "./hwallet-postgres-session-store";
import { createPostgresClientOptions } from "./postgres-client-options";

export type MarketSnapshotSourceProvider = MarketSnapshot["provider"] | "local-sample";

export interface StoredMarketSnapshot {
  id: string;
  provider: MarketSnapshotSourceProvider;
  market: MarketSnapshot;
  capturedAt: string;
}

const dataDir = path.join(process.cwd(), ".agent-wallet-data");
const marketSnapshotsFile = path.join(dataDir, "market-snapshots.jsonl");
let marketSnapshotPool: Pool | undefined;

export async function captureMarketSnapshots(input: {
  sourceProvider?: MarketSnapshotSourceProvider;
  markets: MarketSnapshot[];
  capturedAt?: string;
}): Promise<StoredMarketSnapshot[]> {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const snapshots = input.markets.map((market) => ({
    id: crypto.randomUUID(),
    provider: input.sourceProvider || market.provider,
    market,
    capturedAt
  }));

  if (snapshots.length === 0) return [];

  const storeMode = getHWalletSessionStoreMode();
  if (storeMode !== "postgres") {
    await appendMarketSnapshotsToJsonl(snapshots);
  }
  if (storeMode !== "jsonl") {
    const postgresSnapshots = await captureMarketSnapshotsToPostgres(snapshots);
    if (storeMode === "postgres") return postgresSnapshots;
  }
  return snapshots;
}

export async function listRecentMarketSnapshots(input: {
  provider?: MarketSnapshotSourceProvider;
  limit?: number;
} = {}): Promise<StoredMarketSnapshot[]> {
  if (getHWalletSessionStoreMode() === "postgres") {
    return listRecentMarketSnapshotsFromPostgres(input);
  }
  const snapshots = await readJsonl<Partial<StoredMarketSnapshot>>(marketSnapshotsFile);
  return snapshots
    .map(withSnapshotDefaults)
    .filter((snapshot) => !input.provider || snapshot.provider === input.provider)
    .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))
    .slice(0, input.limit || 100);
}

async function appendMarketSnapshotsToJsonl(snapshots: StoredMarketSnapshot[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await appendFile(marketSnapshotsFile, snapshots.map((snapshot) => JSON.stringify(snapshot)).join("\n") + "\n", "utf8");
}

async function captureMarketSnapshotsToPostgres(
  snapshots: StoredMarketSnapshot[]
): Promise<StoredMarketSnapshot[]> {
  const db = getMarketSnapshotPool();
  const saved: StoredMarketSnapshot[] = [];
  for (const snapshot of snapshots) {
    const market = snapshot.market;
    const result = await db.query(
      [
        "insert into hwallet_market_snapshots",
        "(id, provider, chain_id, event_id, market_id, question, status, market_type, yes_asset_id, no_asset_id, yes_price, no_price, liquidity, volume_24h, volume, start_time, end_date, raw_json, captured_at)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)",
        "returning id, provider, chain_id, event_id, market_id, question, status, market_type, yes_asset_id, no_asset_id, yes_price, no_price, liquidity, volume_24h, volume, start_time, end_date, raw_json, captured_at"
      ].join(" "),
      [
        snapshot.id,
        snapshot.provider,
        market.chainId,
        market.eventId || null,
        market.marketId,
        market.question,
        market.status || null,
        market.marketType || null,
        market.yesAssetId || null,
        market.noAssetId || null,
        market.yesPrice ?? null,
        market.noPrice ?? null,
        market.liquidity ?? null,
        market.volume24h ?? null,
        market.volume ?? null,
        market.startTime ? toPostgresTimestamp(market.startTime) : null,
        market.endDate ? toPostgresTimestamp(market.endDate) : null,
        JSON.stringify(market.raw ?? {}),
        snapshot.capturedAt
      ]
    );
    saved.push(snapshotFromRow(result.rows[0] as MarketSnapshotRow));
  }
  return saved;
}

async function listRecentMarketSnapshotsFromPostgres(input: {
  provider?: MarketSnapshotSourceProvider;
  limit?: number;
} = {}): Promise<StoredMarketSnapshot[]> {
  const params: unknown[] = [];
  const where = input.provider ? "where provider = $1" : "";
  if (input.provider) params.push(input.provider);
  params.push(input.limit || 100);

  const result = await getMarketSnapshotPool().query(
    [
      "select id, provider, chain_id, event_id, market_id, question, status, market_type, yes_asset_id, no_asset_id, yes_price, no_price, liquidity, volume_24h, volume, start_time, end_date, raw_json, captured_at",
      "from hwallet_market_snapshots",
      where,
      `order by captured_at desc limit $${params.length}`
    ].filter(Boolean).join(" "),
    params
  );
  return result.rows.map((row: MarketSnapshotRow) => snapshotFromRow(row));
}

async function readJsonl<T>(file: string): Promise<T[]> {
  const raw = await readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function getMarketSnapshotPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("HWALLET_SESSION_STORE requires DATABASE_URL before using the Postgres market snapshot store.");
  }
  marketSnapshotPool ||= new Pool(createPostgresClientOptions(databaseUrl));
  return marketSnapshotPool;
}

function snapshotFromRow(row: MarketSnapshotRow): StoredMarketSnapshot {
  const provider = readProvider(row.provider);
  const marketProvider: MarketSnapshot["provider"] = provider === "polymarket-plugin" ? "polymarket-plugin" : "okx-outcomes";
  return {
    id: String(row.id || ""),
    provider,
    capturedAt: toIso(row.captured_at),
    market: {
      provider: marketProvider,
      chainId: readChainId(row.chain_id),
      eventId: readString(row.event_id),
      marketId: String(row.market_id || ""),
      question: String(row.question || ""),
      status: readString(row.status),
      marketType: readString(row.market_type),
      yesAssetId: readString(row.yes_asset_id),
      noAssetId: readString(row.no_asset_id),
      yesPrice: readNumber(row.yes_price),
      noPrice: readNumber(row.no_price),
      acceptingOrders: Boolean(row.yes_asset_id || row.no_asset_id) && readString(row.status) !== "closed",
      liquidity: readNumber(row.liquidity),
      volume24h: readNumber(row.volume_24h),
      volume: readNumber(row.volume),
      startTime: row.start_time ? toIso(row.start_time) : undefined,
      endDate: row.end_date ? toIso(row.end_date) : undefined,
      raw: readJsonObject(row.raw_json)
    }
  };
}

function withSnapshotDefaults(input: Partial<StoredMarketSnapshot>): StoredMarketSnapshot {
  return {
    id: input.id || crypto.randomUUID(),
    provider: input.provider || input.market?.provider || "local-sample",
    market: input.market as MarketSnapshot,
    capturedAt: input.capturedAt || new Date().toISOString()
  };
}

function readProvider(value: unknown): MarketSnapshotSourceProvider {
  if (value === "okx-outcomes" || value === "polymarket-plugin" || value === "local-sample") return value;
  return "local-sample";
}

function readChainId(value: unknown): MarketSnapshot["chainId"] {
  return Number(value) === 137 ? 137 : 196;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
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

function toPostgresTimestamp(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

interface MarketSnapshotRow {
  id?: unknown;
  provider?: unknown;
  chain_id?: unknown;
  event_id?: unknown;
  market_id?: unknown;
  question?: unknown;
  status?: unknown;
  market_type?: unknown;
  yes_asset_id?: unknown;
  no_asset_id?: unknown;
  yes_price?: unknown;
  no_price?: unknown;
  liquidity?: unknown;
  volume_24h?: unknown;
  volume?: unknown;
  start_time?: unknown;
  end_date?: unknown;
  raw_json?: unknown;
  captured_at?: unknown;
}
