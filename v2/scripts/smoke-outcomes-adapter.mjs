const checks = [];

const { normalizeOkxOutcomes, pickBestOkxWorldCupMarket } = await import("../execution/okx-outcomes-output.ts");
const { createWorldCupExploreView } = await import("../app/world-cup-explore.ts");
const { sampleOkxWorldCupPayload } = await import("../execution/okx-world-cup-sample.ts");

const normalized = normalizeOkxOutcomes(sampleOkxWorldCupPayload);
assert(normalized.eventsSeen === 1, "reads event list");
assert(normalized.marketsSeen >= 3, "reads nested markets");
assert(normalized.markets.length >= 3, "normalizes markets");

const champion = normalized.markets.find((market) => market.marketId === "sample-spain-champion");
assert(champion?.provider === "okx-outcomes", "sets OKX provider");
assert(champion?.chainId === 196, "sets X Layer chain id");
assert(champion?.yesAssetId === "sample-esp-yes", "reads YES asset id");
assert(champion?.noAssetId === "sample-esp-no", "reads NO asset id");
assert(champion?.yesPrice === 0.17, "parses YES price");
assert(champion?.acceptingOrders === true, "active market with asset is tradeable");

const pending = normalizeOkxOutcomes({
  markets: [
    {
      marketId: "asset-pending",
      question: "暂未上链的市场",
      status: "active",
      yesOutcome: {
        assetId: null,
        price: 0.5
      }
    }
  ]
}).markets[0];
assert(pending?.acceptingOrders === false, "assetId null is watch-only");

const best = pickBestOkxWorldCupMarket(normalized.markets);
assert(Boolean(best?.marketId), "picks a best tradeable market");

const explore = createWorldCupExploreView(normalized.markets);
assert(explore.type === "world_cup_explore_view", "creates explore view");
assert(Boolean(explore.source.label), "adds source label");
assert(explore.cards.champion.length >= 1, "maps champion category");
assert(explore.cards.champion.some((card) => card.title === "西班牙会赢得 2026 年世界杯冠军吗？"), "renders friendly Chinese title");
assert(explore.cards.champion.some((card) => card.displayName === "西班牙"), "renders short display name");
assert(explore.cards.champion.every((card) => card.displayTitle), "renders display title");
assert(explore.cards.champion.every((card) => Boolean(card.agentNote)), "adds friendly agent notes");
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
