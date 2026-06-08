import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SimulationCard, StrategyCard, TrackingCard } from "../domain/types";

export type PhaseOneEventType = "tracking.saved" | "strategy.saved" | "simulation.saved";

export const DEFAULT_PHASE_ONE_USER_ID = "demo-user";

export interface PhaseOneRecord {
  id: string;
  userId: string;
  idempotencyKey?: string;
  type: PhaseOneEventType;
  title: string;
  note: string;
  card: TrackingCard | StrategyCard | SimulationCard;
  createdAt: string;
}

type PhaseOneRecordInput = Omit<PhaseOneRecord, "id" | "createdAt" | "userId"> & {
  userId?: string;
};

const dataDir = path.join(process.cwd(), ".agent-wallet-data");
const recordsFile = path.join(dataDir, "phase-one-records.jsonl");

export async function savePhaseOneRecord(input: PhaseOneRecordInput): Promise<PhaseOneRecord> {
  if (input.idempotencyKey) {
    const existing = await findPhaseOneRecordByIdempotencyKey(input.userId || DEFAULT_PHASE_ONE_USER_ID, input.idempotencyKey);
    if (existing) return existing;
  }

  const record: PhaseOneRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    userId: input.userId || DEFAULT_PHASE_ONE_USER_ID
  };

  await mkdir(dataDir, { recursive: true });
  await appendFile(recordsFile, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function findPhaseOneRecordByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<PhaseOneRecord | undefined> {
  const records = await listPhaseOneRecords(userId);
  return records.find((record) => record.idempotencyKey === idempotencyKey);
}

export async function listPhaseOneRecords(userId = DEFAULT_PHASE_ONE_USER_ID): Promise<PhaseOneRecord[]> {
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

export async function listTrackingCards(userId = DEFAULT_PHASE_ONE_USER_ID): Promise<TrackingCard[]> {
  const records = await listPhaseOneRecords(userId);
  return records
    .filter((record) => record.type === "tracking.saved" && record.card.type === "tracking_card")
    .map((record) => record.card as TrackingCard);
}

export async function listStrategyCards(userId = DEFAULT_PHASE_ONE_USER_ID): Promise<StrategyCard[]> {
  const records = await listPhaseOneRecords(userId);
  return records
    .filter((record) => record.type === "strategy.saved" && record.card.type === "strategy_card")
    .map((record) => record.card as StrategyCard);
}

export function readPhaseOneUserId(url: string): string {
  const userId = new URL(url).searchParams.get("userId")?.trim();
  return userId || DEFAULT_PHASE_ONE_USER_ID;
}

function withRecordDefaults(record: Partial<PhaseOneRecord>): PhaseOneRecord {
  return {
    id: record.id || crypto.randomUUID(),
    userId: record.userId || DEFAULT_PHASE_ONE_USER_ID,
    idempotencyKey: record.idempotencyKey,
    type: record.type || "simulation.saved",
    title: record.title || "记录",
    note: record.note || "",
    card: record.card as PhaseOneRecord["card"],
    createdAt: record.createdAt || new Date().toISOString()
  };
}
