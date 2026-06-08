const checks = [];

const sample = {
  events: [
    {
      eventId: "world-cup-2026",
      eventTitle: "2026 FIFA World Cup",
      markets: [
        {
          marketId: "spain-champion",
          question: "西班牙会赢得 2026 年世界杯冠军吗？",
          status: "active",
          marketType: "neg_risk",
          volume24h: "786700",
          yesOutcome: {
            assetId: "100049000",
            price: "0.17"
          },
          noOutcome: {
            assetId: "100049001",
            price: "0.83"
          }
        },
        {
          marketId: "mexico-south-africa",
          question: "墨西哥 vs 南非，墨西哥会赢吗？",
          status: "active",
          marketType: "binary",
          volume: 1212300,
          outcomes: [
            {
              name: "YES",
              assetId: "100050000",
              price: 0.69
            },
            {
              name: "NO",
              assetId: "100050001",
              price: 0.31
            }
          ]
        },
        {
          marketId: "asset-pending",
          question: "暂未上链的市场",
          status: "active",
          outcomes: [
            {
              name: "YES",
              assetId: null,
              price: 0.5
            }
          ]
        }
      ]
    }
  ]
};

const { normalizeOkxOutcomes, pickBestOkxWorldCupMarket } = await import("../execution/okx-outcomes-output.ts");
const { createWorldCupExploreView } = await import("../app/world-cup-explore.ts");

const normalized = normalizeOkxOutcomes(sample);
assert(normalized.eventsSeen === 1, "reads event list");
assert(normalized.marketsSeen === 3, "reads nested markets");
assert(normalized.markets.length === 3, "normalizes markets");

const champion = normalized.markets.find((market) => market.marketId === "spain-champion");
assert(champion?.provider === "okx-outcomes", "sets OKX provider");
assert(champion?.chainId === 196, "sets X Layer chain id");
assert(champion?.yesAssetId === "100049000", "reads YES asset id");
assert(champion?.noAssetId === "100049001", "reads NO asset id");
assert(champion?.yesPrice === 0.17, "parses YES price");
assert(champion?.acceptingOrders === true, "active market with asset is tradeable");

const pending = normalized.markets.find((market) => market.marketId === "asset-pending");
assert(pending?.acceptingOrders === false, "assetId null is watch-only");

const best = pickBestOkxWorldCupMarket(normalized.markets);
assert(Boolean(best?.marketId), "picks a best tradeable market");

const explore = createWorldCupExploreView(normalized.markets);
assert(explore.type === "world_cup_explore_view", "creates explore view");
assert(explore.cards.champion.length >= 1, "maps champion category");
assert(explore.cards.upcoming_matches.length >= 1, "maps match category");

console.log(JSON.stringify({
  ok: true,
  checks,
  markets: normalized.markets.length,
  best: best?.marketId,
  categories: Object.fromEntries(Object.entries(explore.cards).map(([key, cards]) => [key, cards.length]))
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Outcomes adapter smoke failed: ${label}`);
  checks.push(label);
}
