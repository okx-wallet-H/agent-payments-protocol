import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { PredictionCard, SimulationCard, StrategyCard, TrackingCard } from "../domain/types";
import { getHWalletSessionStoreMode } from "./hwallet-postgres-session-store";
import { createPostgresClientOptions } from "./postgres-client-options";

export type PhaseOneEventType = "prediction.saved" | "tracking.saved" | "strategy.saved" | "simulation.saved";

const LEGACY_PHASE_ONE_USER_ID = "legacy-missing-user";

export interface PhaseOneRecord {
  id: string;
  userId: string;
  idempotencyKey?: string;
  type: PhaseOneEventType;
  title: string;
  note: string;
  card: PredictionCard | TrackingCard | StrategyCard | SimulationCard;
  createdAt: string;
}

type PhaseOneRecordInput = Omit<PhaseOneRecord, "id" | "createdAt">;

const dataDir = path.join(process.cwd(), ".agent-wallet-data");
const recordsFile = path.join(dataDir, "phase-one-records.jsonl");
let phaseOnePool: Pool | undefined;

export async function savePhaseOneRecord(input: PhaseOneRecordInput): Promise<PhaseOneRecord> {
  const userId = requirePhaseOneUserId(input.userId);
  if (input.idempotencyKey) {
    const existing = await findPhaseOneRecordByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) return existing;
  }

  const record: PhaseOneRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    userId
  };

  const storeMode = getHWalletSessionStoreMode();
  if (storeMode !== "postgres") {
    await mkdir(dataDir, { recursive: true });
    await appendFile(recordsFile, `${JSON.stringify(record)}\n`, "utf8");
  }
  if (storeMode !== "jsonl") {
    const postgresRecord = await savePhaseOneRecordToPostgres(record);
    if (storeMode === "postgres") return postgresRecord;
  }
  return record;
}

export async function findPhaseOneRecordByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<PhaseOneRecord | undefined> {
  const normalizedUserId = requirePhaseOneUserId(userId);
  if (getHWalletSessionStoreMode() === "postgres") {
    return findPhaseOneRecordByIdempotencyKeyFromPostgres(normalizedUserId, idempotencyKey);
  }
  const records = await listPhaseOneRecords(normalizedUserId);
  return records.find((record) => record.idempotencyKey === idempotencyKey);
}

export async function listPhaseOneRecords(userId: string): Promise<PhaseOneRecord[]> {
  const normalizedUserId = requirePhaseOneUserId(userId);
  if (getHWalletSessionStoreMode() === "postgres") {
    return listPhaseOneRecordsFromPostgres(normalizedUserId);
  }
  return listPhaseOneRecordsFromJsonl(normalizedUserId);
}

async function listPhaseOneRecordsFromJsonl(userId: string): Promise<PhaseOneRecord[]> {
  const raw = await readFile(recordsFile, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => withRecordDefaults(JSON.parse(line) as Partial<PhaseOneRecord>))
    .filter((record) => record.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function savePhaseOneRecordToPostgres(record: PhaseOneRecord): Promise<PhaseOneRecord> {
  const db = getPhaseOnePool();
  await db.query(
    [
      "insert into app_users (id, created_at, updated_at)",
      "values ($1,$2,$2)",
      "on conflict (id) do update set updated_at = greatest(app_users.updated_at, excluded.updated_at)"
    ].join(" "),
    [record.userId, record.createdAt]
  );

  const result = await db.query(
    [
      "insert into hwallet_agent_records",
      "(id, user_id, idempotency_key, type, title, note, card_json, created_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8)",
      "on conflict (user_id, idempotency_key) where idempotency_key is not null",
      "do update set idempotency_key = excluded.idempotency_key",
      "returning id, user_id, idempotency_key, type, title, note, card_json, created_at"
    ].join(" "),
    [
      record.id,
      record.userId,
      record.idempotencyKey || null,
      record.type,
      record.title,
      record.note,
      JSON.stringify(record.card),
      record.createdAt
    ]
  );

  return phaseOneRecordFromRow(result.rows[0] as PhaseOneRecordRow);
}

async function findPhaseOneRecordByIdempotencyKeyFromPostgres(
  userId: string,
  idempotencyKey: string
): Promise<PhaseOneRecord | undefined> {
  const result = await getPhaseOnePool().query(
    [
      "select id, user_id, idempotency_key, type, title, note, card_json, created_at",
      "from hwallet_agent_records",
      "where user_id = $1 and idempotency_key = $2",
      "order by created_at desc",
      "limit 1"
    ].join(" "),
    [userId, idempotencyKey]
  );
  if (!result.rowCount) return undefined;
  return phaseOneRecordFromRow(result.rows[0] as PhaseOneRecordRow);
}

async function listPhaseOneRecordsFromPostgres(userId: string): Promise<PhaseOneRecord[]> {
  const result = await getPhaseOnePool().query(
    [
      "select id, user_id, idempotency_key, type, title, note, card_json, created_at",
      "from hwallet_agent_records",
      "where user_id = $1",
      "order by created_at desc",
      "limit 100"
    ].join(" "),
    [userId]
  );
  return result.rows.map((row: PhaseOneRecordRow) => phaseOneRecordFromRow(row));
}

export async function listTrackingCards(userId: string): Promise<TrackingCard[]> {
  const records = await listPhaseOneRecords(userId);
  return records
    .filter((record) => record.type === "tracking.saved" && record.card.type === "tracking_card")
    .map((record) => record.card as TrackingCard);
}

export async function listPredictionCards(userId: string): Promise<PredictionCard[]> {
  const records = await listPhaseOneRecords(userId);
  return records
    .filter((record) => record.type === "prediction.saved" && record.card.type === "prediction_card")
    .map((record) => record.card as PredictionCard);
}

export async function listStrategyCards(userId: string): Promise<StrategyCard[]> {
  const records = await listPhaseOneRecords(userId);
  return records
    .filter((record) => record.type === "strategy.saved" && record.card.type === "strategy_card")
    .map((record) => record.card as StrategyCard);
}

function withRecordDefaults(record: Partial<PhaseOneRecord>): PhaseOneRecord {
  return {
    id: record.id || crypto.randomUUID(),
    userId: record.userId || LEGACY_PHASE_ONE_USER_ID,
    idempotencyKey: record.idempotencyKey,
    type: record.type || "simulation.saved",
    title: record.title || "记录",
    note: record.note || "",
    card: record.card as PhaseOneRecord["card"],
    createdAt: record.createdAt || new Date().toISOString()
  };
}

function phaseOneRecordFromRow(row: PhaseOneRecordRow): PhaseOneRecord {
  return withRecordDefaults({
    id: String(row.id || ""),
    userId: String(row.user_id || LEGACY_PHASE_ONE_USER_ID),
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : undefined,
    type: String(row.type || "simulation.saved") as PhaseOneEventType,
    title: String(row.title || "记录"),
    note: String(row.note || ""),
    card: readCard(row.card_json),
    createdAt: toIso(row.created_at)
  });
}

function requirePhaseOneUserId(userId: string | undefined): string {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!normalized) {
    throw new Error("Phase One record userId is required");
  }
  return normalized;
}

function getPhaseOnePool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("HWALLET_SESSION_STORE requires DATABASE_URL before using the Postgres phase-one record store.");
  }
  phaseOnePool ||= new Pool(createPostgresClientOptions(databaseUrl));
  return phaseOnePool;
}

function readCard(value: unknown): PhaseOneRecord["card"] {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as PhaseOneRecord["card"];
  if (typeof value !== "string") return {} as PhaseOneRecord["card"];
  try {
    return JSON.parse(value) as PhaseOneRecord["card"];
  } catch {
    return {} as PhaseOneRecord["card"];
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

interface PhaseOneRecordRow {
  id?: unknown;
  user_id?: unknown;
  idempotency_key?: unknown;
  type?: unknown;
  title?: unknown;
  note?: unknown;
  card_json?: unknown;
  created_at?: unknown;
}
