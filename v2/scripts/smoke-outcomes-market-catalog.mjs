const checks = [];

const { normalizeOkxOutcomeMarketCatalog, normalizeOkxOutcomeMarketSummary } = await import(
  "../execution/okx-outcomes-client.ts"
);

const catalog = normalizeOkxOutcomeMarketCatalog({
  code: "0",
  data: {
    events: [
      {
        event_id: "evt-world-cup-final",
        eventTitle: "2026 World Cup final",
        market_list: [
          {
            market_id: "mkt-argentina-final",
            market_title: "Will Argentina win the 2026 World Cup final?",
            status: "active",
            market_type: "binary",
            outcome_list: [
              { name: "YES", asset_id: "arg-final-yes", price: "64" },
              { name: "NO", asset_id: "arg-final-no", price: "36" }
            ],
            volume_24h: "1200000",
            liquidity_usd: "420000"
          }
        ]
      }
    ]
  }
});

assert(catalog.length === 1, "normalizes nested event market catalog");

const [finalMarket] = catalog;
assert(finalMarket.eventId === "evt-world-cup-final", "keeps event id");
assert(finalMarket.marketId === "mkt-argentina-final", "keeps market id");
assert(finalMarket.title === "Will Argentina win the 2026 World Cup final?", "keeps market title");
assert(finalMarket.outcomes.yes.side === "yes", "adds YES outcome");
assert(finalMarket.outcomes.no.side === "no", "adds NO outcome");
assert(finalMarket.outcomes.yes.assetIdLabel === "arg-fi...-yes", "redacts YES asset id");
assert(finalMarket.outcomes.no.assetIdLabel === "arg-fi...l-no", "redacts NO asset id");
assert(finalMarket.priceLabels.yes === "64%", "formats YES price label");
assert(finalMarket.priceLabels.no === "36%", "formats NO price label");
assert(finalMarket.volumeLabel === "24h volume $1.2M", "formats volume label");
assert(finalMarket.liquidityLabel === "Liquidity $420K", "formats liquidity label");
assert(finalMarket.providerLabel === "OKX Outcomes", "adds provider label");
assert(finalMarket.readOnly === true, "marks market summary read-only");
assert(finalMarket.liveExecutionClosed === true, "marks live execution closed");
assert(finalMarket.safeModes.includes("observe"), "allows observe mode");
assert(finalMarket.safeModes.includes("simulate-only"), "allows simulate-only mode");

const liveLikeCatalog = normalizeOkxOutcomeMarketCatalog({
  code: "0",
  data: [
    {
      marketId: "mkt-brazil-group",
      question: "Will Brazil finish top of Group C?",
      status: "active",
      yesPrice: "0.58",
      noPrice: "0.42",
      volume24h: "85000",
      liquidity: "12000",
      provider: "okx-outcomes"
    }
  ]
});

assert(liveLikeCatalog.length === 1, "normalizes live-like data array");
assert(liveLikeCatalog[0]?.priceLabels.yes === "58%", "formats direct YES price");
assert(liveLikeCatalog[0]?.priceLabels.no === "42%", "formats direct NO price");
assert(liveLikeCatalog[0]?.volumeLabel === "24h volume $85K", "formats direct volume");
assert(liveLikeCatalog[0]?.liquidityLabel === "Liquidity $12K", "formats direct liquidity");

const summary = normalizeOkxOutcomeMarketSummary({
  marketId: "mkt-spain-semis",
  question: "Will Spain reach the semifinals?",
  status: "active",
  yesOutcome: { assetId: "spain-semis-yes", price: "72" },
  noOutcome: { assetId: "spain-semis-no", price: "28" },
  volume: "32000"
});

assert(summary?.marketId === "mkt-spain-semis", "normalizes single market summary");
assert(summary?.priceLabels.yes === "72%", "formats single summary YES price");
assert(summary?.volumeLabel === "Volume $32K", "falls back to total volume label");
assert(summary?.readOnly === true, "single summary is read-only");
assert(summary?.liveExecutionClosed === true, "single summary keeps live execution closed");

const serialized = JSON.stringify({ catalog, liveLikeCatalog, summary }).toLowerCase();
const blockedTerms = ["buy", "sell", "swap", "broadcast", "signature", "privatekey", "place_order"];
assert(blockedTerms.every((term) => !serialized.includes(term)), "catalog output avoids transaction terms");
assert(!serialized.includes("arg-final-yes"), "catalog output avoids full YES asset id");
assert(!serialized.includes("arg-final-no"), "catalog output avoids full NO asset id");
assert(!serialized.includes("spain-semis-yes"), "single summary avoids full YES asset id");

console.log(
  JSON.stringify(
    {
      ok: true,
      checks,
      markets: catalog.length + liveLikeCatalog.length + (summary ? 1 : 0),
      modes: finalMarket.safeModes
    },
    null,
    2
  )
);

function assert(condition, label) {
  if (!condition) throw new Error(`Outcomes market catalog smoke failed: ${label}`);
  checks.push(label);
}
