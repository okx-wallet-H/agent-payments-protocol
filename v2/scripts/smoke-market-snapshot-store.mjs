import { normalizeOkxOutcomes } from "../execution/okx-outcomes-output.ts";
import { sampleOkxWorldCupPayload } from "../execution/okx-world-cup-sample.ts";
import { captureMarketSnapshots, listRecentMarketSnapshots } from "../storage/market-snapshot-store.ts";

process.env.HWALLET_SESSION_STORE = "jsonl";

const capturedAt = new Date().toISOString();
const markets = normalizeOkxOutcomes(sampleOkxWorldCupPayload).markets.slice(0, 3);
const snapshots = await captureMarketSnapshots({
  sourceProvider: "local-sample",
  markets,
  capturedAt
});

const recent = await listRecentMarketSnapshots({
  provider: "local-sample",
  limit: 10
});

assert(markets.length >= 3, "sample markets available");
assert(snapshots.length === markets.length, "captures all markets");
assert(snapshots.every((snapshot) => snapshot.provider === "local-sample"), "stores source provider");
assert(snapshots.every((snapshot) => snapshot.capturedAt === capturedAt), "stores capture timestamp");
assert(recent.some((snapshot) => snapshot.id === snapshots[0].id), "lists captured snapshot");
assert(recent.every((snapshot) => snapshot.provider === "local-sample"), "filters by provider");
assert(recent[0].capturedAt >= recent[recent.length - 1].capturedAt, "sorts newest first");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "sample markets available",
    "captures all markets",
    "stores source provider",
    "stores capture timestamp",
    "lists captured snapshot",
    "filters by provider",
    "sorts newest first"
  ],
  captured: snapshots.length
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Market snapshot store smoke failed: ${label}`);
}
