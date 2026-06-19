import assert from "node:assert/strict";

const enabled = ["1", "true", "yes"].includes(String(process.env.OKX_OUTCOMES_LIVE_SCHEMA_SMOKE || "").toLowerCase());
const checks = [];

if (!enabled) {
  pass("live schema smoke is opt-in");
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: true,
        reason: "OKX_OUTCOMES_LIVE_SCHEMA_SMOKE is not enabled",
        readOnly: true,
        liveExecutionClosed: true,
        checks
      },
      null,
      2
    )
  );
  process.exit(0);
}

const { hasOkxOutcomesCredentials, listOkxWorldCupMarkets, getOkxOutcomeMarketData } = await import(
  "../execution/okx-outcomes-client.ts"
);

assert(hasOkxOutcomesCredentials(), "OKX Outcomes credentials are required for live schema smoke");
pass("OKX Outcomes credentials are present");

const markets = await listOkxWorldCupMarkets();
assert(markets.length > 0, "live schema smoke requires at least one market");
pass("event search and event market reads returned markets");

const selected = markets.find((market) => market.marketId && market.yesAssetId && market.noAssetId);
assert(selected?.marketId && selected.yesAssetId && selected.noAssetId, "live schema smoke requires YES and NO outcome ids");
pass("selected market has marketId plus YES and NO outcome ids");

const detail = await getOkxOutcomeMarketData(selected.marketId, {
  includeCandles: true,
  includeOrderBook: true,
  candleLimit: 6,
  bookSize: 5
});

assert(detail.market?.marketId === selected.marketId, "market detail uses marketId");
pass("market detail was fetched by marketId");

assert(detail.market.yesAssetId && detail.market.noAssetId, "market detail includes YES and NO outcome ids");
pass("market detail includes YES and NO outcome ids");

assertOutcomeRead("YES", detail.market.yesAssetId, detail.yesTicker, detail.yesCandles, detail.yesOrderBook);
assertOutcomeRead("NO", detail.market.noAssetId, detail.noTicker, detail.noCandles, detail.noOrderBook);
pass("YES and NO ticker/candle/order-book reads use outcome asset ids as instId");

const settlementCandidateFields = findSettlementCandidateFields(detail.market.raw);
pass("settlement/final-result candidate fields were inspected without display mapping");

const output = {
  ok: true,
  mode: "live",
  readOnly: true,
  liveExecutionClosed: true,
  sample: {
    eventIdLabel: redact(detail.market.eventId),
    marketIdLabel: redact(detail.market.marketId),
    yesAssetIdLabel: redact(detail.market.yesAssetId),
    noAssetIdLabel: redact(detail.market.noAssetId),
    yesTicker: Boolean(detail.yesTicker),
    noTicker: Boolean(detail.noTicker),
    yesCandles: detail.yesCandles?.length || 0,
    noCandles: detail.noCandles?.length || 0,
    yesOrderBookLevels: countOrderBookLevels(detail.yesOrderBook),
    noOrderBookLevels: countOrderBookLevels(detail.noOrderBook),
    settlementCandidateFields
  },
  checks
};

const outputJson = JSON.stringify(output);
for (const secretEnvKey of ["PREDICTIONS_API_KEY", "PREDICTIONS_API_SECRET", "PREDICTIONS_API_PASSPHRASE"]) {
  const value = process.env[secretEnvKey];
  if (value) assert(!outputJson.includes(value), `output must not expose ${secretEnvKey}`);
}
for (const internalId of [detail.market.marketId, detail.market.yesAssetId, detail.market.noAssetId].filter(Boolean)) {
  assert(!outputJson.includes(internalId), "output must not expose full market or outcome ids");
}
pass("live schema smoke output is redacted");

console.log(JSON.stringify(output, null, 2));

function assertOutcomeRead(label, instId, ticker, candles, orderBook) {
  assert(instId, `${label} outcome id is required`);
  assert(ticker?.instId === instId, `${label} ticker must use outcome asset id as instId`);
  assert(Array.isArray(candles) && candles.length > 0, `${label} candles are required for live schema smoke`);
  assert(candles.every((candle) => candle.instId === instId), `${label} candles must use outcome asset id as instId`);
  assert(orderBook?.instId === instId, `${label} order book must use outcome asset id as instId`);
}

function findSettlementCandidateFields(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const record = raw;
  const candidates = [
    "settlement",
    "settlementStatus",
    "settlement_status",
    "finalResult",
    "final_result",
    "result",
    "outcome",
    "winner",
    "resolution"
  ];
  return candidates.filter((field) => Object.prototype.hasOwnProperty.call(record, field)).sort();
}

function countOrderBookLevels(book) {
  if (!book) return 0;
  return book.bids.length + book.asks.length;
}

function redact(value) {
  if (!value) return undefined;
  const text = String(value);
  if (text.length <= 4) return "redacted";
  if (text.length <= 12) return `${text.slice(0, 2)}...${text.slice(-2)}`;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function pass(label) {
  checks.push(label);
}
