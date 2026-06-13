import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live market snapshot Postgres smoke.");
  process.exit(1);
}

const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));
const { normalizeOkxOutcomes } = await import("../execution/okx-outcomes-output.ts");
const { sampleOkxWorldCupPayload } = await import("../execution/okx-world-cup-sample.ts");
const { captureMarketSnapshots, listRecentMarketSnapshots } = await import("../storage/market-snapshot-store.ts");

const capturedAt = new Date().toISOString();
const markets = normalizeOkxOutcomes(sampleOkxWorldCupPayload).markets.slice(0, 3);
let snapshots = [];

try {
  process.env.HWALLET_SESSION_STORE = "dual";
  snapshots = await captureMarketSnapshots({
    sourceProvider: "local-sample",
    markets,
    capturedAt
  });

  assert(snapshots.length === markets.length, "dual write returns snapshots");

  process.env.HWALLET_SESSION_STORE = "postgres";
  const recent = await listRecentMarketSnapshots({
    provider: "local-sample",
    limit: 20
  });
  const ids = new Set(snapshots.map((snapshot) => snapshot.id));
  const restored = recent.filter((snapshot) => ids.has(snapshot.id));

  assert(restored.length === snapshots.length, "postgres reads saved snapshots");
  assert(restored.every((snapshot) => snapshot.provider === "local-sample"), "postgres preserves source provider");
  assert(restored.every((snapshot) => snapshot.market.provider === "okx-outcomes"), "postgres restores market provider");
  assert(restored.every((snapshot) => snapshot.market.chainId === 196), "postgres restores chain id");
  assert(restored.some((snapshot) => snapshot.market.yesPrice !== undefined), "postgres restores price");
  assert(recent[0].capturedAt >= recent[recent.length - 1].capturedAt, "postgres sorts newest first");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "dual write returned snapshots",
      "postgres read returned snapshots",
      "source provider restored",
      "market provider restored",
      "chain id restored",
      "price restored",
      "newest first ordering"
    ],
    captured: snapshots.length
  }, null, 2));
} finally {
  if (snapshots.length > 0) {
    await pool.query("delete from hwallet_market_snapshots where id = any($1)", [
      snapshots.map((snapshot) => snapshot.id)
    ]).catch(() => undefined);
  }
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
  if (!condition) throw new Error(`Live market snapshot Postgres smoke failed: ${label}`);
}
