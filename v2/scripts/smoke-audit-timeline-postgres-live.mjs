import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live audit timeline Postgres smoke.");
  process.exit(1);
}

const userId = `audit-live-${Date.now()}`;
const otherUserId = `${userId}-other`;
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";
const walletRecordId = `wallet-tx-${txHash}`;
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));
const { listAuditTimelineEvents, saveAuditTimelineEvent } = await import("../storage/audit-timeline-store.ts");

try {
  process.env.HWALLET_SESSION_STORE = "dual";
  await saveAuditTimelineEvent({
    userId,
    type: "wallet.tx_verified",
    title: "已确认到账",
    note: "live audit smoke wallet transfer",
    status: "success",
    txHash,
    explorerUrl: `https://www.oklink.com/xlayer/tx/${txHash}`,
    chainId: 196,
    assetSymbol: "USDT0",
    amountLabel: "0.053127",
    tokenAddress: "0x0000000000000000000000000000000000000001",
    walletRecordId
  });
  await saveAuditTimelineEvent({
    userId,
    type: "simulation.completed",
    title: "已完成模拟",
    note: "live audit smoke simulation",
    status: "success",
    marketId: "worldcup-spain",
    marketTitle: "西班牙会赢得 2026 年世界杯冠军吗？",
    amountLabel: "1 USDT",
    simulationSide: "Yes",
    simulationShares: "2.1",
    simulationPrice: "52.4c",
    recordId: "record-live-audit-simulation"
  });

  process.env.HWALLET_SESSION_STORE = "postgres";
  const events = await listAuditTimelineEvents(userId);
  const otherEvents = await listAuditTimelineEvents(otherUserId);
  const walletEvent = events.find((event) => event.type === "wallet.tx_verified");
  const simulationEvent = events.find((event) => event.type === "simulation.completed");

  assert(events.length === 2, "postgres returns saved audit events");
  assert(events.every((event) => event.moneyMoved === false), "postgres preserves money_moved false");
  assert(events[0].createdAt >= events[1].createdAt, "postgres sorts newest first");
  assert(walletEvent?.txHash === txHash, "postgres returns tx hash");
  assert(walletEvent?.walletRecordId === walletRecordId, "postgres returns wallet record id from metadata");
  assert(walletEvent?.tokenAddress === "0x0000000000000000000000000000000000000001", "postgres returns token address from metadata");
  assert(simulationEvent?.recordId === "record-live-audit-simulation", "postgres returns record id from metadata");
  assert(simulationEvent?.simulationSide === "Yes", "postgres returns simulation side");
  assert(otherEvents.length === 0, "postgres keeps other user isolated");

  console.log(JSON.stringify({
    ok: true,
    userId,
    checks: [
      "dual write completed",
      "postgres read returned audit events",
      "money movement remains false",
      "newest first ordering",
      "wallet tx fields restored",
      "wallet record id restored from metadata",
      "simulation fields restored from metadata",
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

function assert(condition, label) {
  if (!condition) throw new Error(`Live audit timeline Postgres smoke failed: ${label}`);
}
