import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live phase-one records Postgres smoke.");
  process.exit(1);
}

const userId = `phase-one-live-${Date.now()}`;
const otherUserId = `${userId}-other`;
const idempotencyKey = `track-${userId}-spain-world-cup`;
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));

const { createTrackingCard } = await import("../agent/tracking-card.ts");
const { createStrategyCard } = await import("../agent/strategy-card.ts");
const {
  findPhaseOneRecordByIdempotencyKey,
  listPhaseOneRecords,
  listStrategyCards,
  listTrackingCards,
  savePhaseOneRecord
} = await import("../storage/phase-one-store.ts");

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "world-cup-2026",
  marketId: "world-cup-2026-spain-winner",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  status: "active",
  marketType: "binary",
  yesPrice: 0.52,
  noPrice: 0.48,
  acceptingOrders: true,
  liquidity: 120000,
  volume24h: 8600,
  raw: {
    source: "live phase-one records smoke"
  }
};

try {
  process.env.HWALLET_SESSION_STORE = "dual";

  const trackingCard = createTrackingCard(market);
  const trackingRecord = await savePhaseOneRecord({
    userId,
    idempotencyKey,
    type: "tracking.saved",
    title: trackingCard.title,
    note: trackingCard.agentNote,
    card: trackingCard
  });

  const strategyCard = createStrategyCard(market);
  const strategyRecord = await savePhaseOneRecord({
    userId,
    type: "strategy.saved",
    title: strategyCard.title,
    note: strategyCard.agentNote,
    card: strategyCard
  });

  assert(trackingRecord.type === "tracking.saved", "dual write returns tracking record");
  assert(strategyRecord.type === "strategy.saved", "dual write returns strategy record");

  process.env.HWALLET_SESSION_STORE = "postgres";

  const duplicate = await savePhaseOneRecord({
    userId,
    idempotencyKey,
    type: "tracking.saved",
    title: "重复跟踪记录",
    note: "duplicate should return existing record",
    card: trackingCard
  });
  const found = await findPhaseOneRecordByIdempotencyKey(userId, idempotencyKey);
  const records = await listPhaseOneRecords(userId);
  const otherRecords = await listPhaseOneRecords(otherUserId);
  const trackingCards = await listTrackingCards(userId);
  const strategyCards = await listStrategyCards(userId);

  assert(duplicate.id === trackingRecord.id, "postgres idempotency returns existing record");
  assert(found?.id === trackingRecord.id, "postgres finds record by idempotency key");
  assert(records.some((record) => record.id === trackingRecord.id), "postgres lists tracking record");
  assert(records.some((record) => record.id === strategyRecord.id), "postgres lists strategy record");
  assert(records[0].createdAt >= records[records.length - 1].createdAt, "postgres sorts newest first");
  assert(trackingCards.some((card) => card.id === trackingCard.id), "postgres restores tracking card");
  assert(strategyCards.some((card) => card.id === strategyCard.id), "postgres restores strategy card");
  assert(otherRecords.length === 0, "postgres keeps other user isolated");

  console.log(JSON.stringify({
    ok: true,
    userId,
    checks: [
      "dual write completed",
      "postgres idempotency returned existing record",
      "postgres find by idempotency works",
      "postgres lists records newest first",
      "tracking card restored",
      "strategy card restored",
      "other user isolated"
    ]
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = any($1)", [[userId, otherUserId]]).catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.env.HWALLET_SESSION_STORE = "jsonl";
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
      if (key !== "DATABASE_URL") continue;
      process.env.DATABASE_URL = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      return;
    }
  }
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function assert(condition, label) {
  if (!condition) throw new Error(`Live phase-one records Postgres smoke failed: ${label}`);
}
