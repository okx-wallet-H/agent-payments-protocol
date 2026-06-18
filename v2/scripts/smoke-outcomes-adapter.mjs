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
assert(champion?.acceptingOrders === true, "active market with asset is observable");

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
assert(Boolean(best?.marketId), "picks a best observable market");

const explore = createWorldCupExploreView(normalized.markets);
assert(explore.type === "world_cup_explore_view", "creates explore view");
assert(Boolean(explore.source.label), "adds source label");
assert(explore.summary.totalMarkets === normalized.markets.length, "summarizes total market count");
assert(explore.summary.categoryCounts.champion === explore.cards.champion.length, "summarizes champion count");
assert(explore.cards.champion.length >= 1, "maps champion category");
assert(explore.cards.champion.some((card) => card.title === "西班牙会赢得 2026 年世界杯冠军吗？"), "renders friendly Chinese title");
assert(explore.cards.champion.some((card) => card.displayName === "西班牙"), "renders short display name");
assert(explore.cards.champion.every((card) => card.displayTitle), "renders display title");
assert(explore.cards.champion.every((card) => Boolean(card.agentNote)), "adds friendly agent notes");
assert(explore.cards.champion.every((card) => card.status === "observable" || card.status === "watch_only"), "uses observe-first card status");
assert(isSortedByVolume(explore.cards.champion), "sorts champion cards by market volume");
assert(explore.cards.upcoming_matches.length >= 1, "maps match category");
assert(explore.cards.upcoming_matches.some((card) => Boolean(card.market.startTime)), "reads match start time");
assert(explore.cards.upcoming_matches.some((card) => Boolean(card.timing?.label)), "adds match timing label");
assert(explore.cards.upcoming_matches.some((card) => /开赛|进行中/.test(card.subtitle || "")), "uses timing as match subtitle");

await assertOkxReadOnlyMarketDataClient();

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

function isSortedByVolume(cards) {
  return cards.every((card, index) => {
    if (index === 0) return true;
    return volumeScore(cards[index - 1].market) >= volumeScore(card.market);
  });
}

function volumeScore(market) {
  return market.volume24h || market.volume || market.liquidity || 0;
}

async function assertOkxReadOnlyMarketDataClient() {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    PREDICTIONS_API_KEY: process.env.PREDICTIONS_API_KEY,
    PREDICTIONS_API_SECRET: process.env.PREDICTIONS_API_SECRET,
    PREDICTIONS_API_PASSPHRASE: process.env.PREDICTIONS_API_PASSPHRASE,
    OKX_OUTCOMES_BASE_URL: process.env.OKX_OUTCOMES_BASE_URL
  };
  const calls = [];

  process.env.PREDICTIONS_API_KEY = "smoke-key";
  process.env.PREDICTIONS_API_SECRET = "smoke-secret";
  process.env.PREDICTIONS_API_PASSPHRASE = "smoke-passphrase";
  process.env.OKX_OUTCOMES_BASE_URL = "https://okx-smoke.local";

  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    calls.push({
      path: parsed.pathname,
      search: parsed.search,
      method: init.method,
      hasKey: Boolean(init.headers?.["OK-ACCESS-KEY"]),
      hasSignature: Boolean(init.headers?.["OK-ACCESS-SIGN"]),
      hasTimestamp: Boolean(init.headers?.["OK-ACCESS-TIMESTAMP"]),
      hasPassphrase: Boolean(init.headers?.["OK-ACCESS-PASSPHRASE"])
    });

    if (parsed.pathname === "/api/v5/predictions/markets/smoke-market") {
      return jsonResponse({
        marketId: "smoke-market",
        question: "Will Spain win the 2026 FIFA World Cup?",
        status: "active",
        marketType: "binary",
        yesOutcome: { assetId: "yes-asset", price: "64" },
        noOutcome: { assetId: "no-asset", price: "36" }
      });
    }

    if (parsed.pathname === "/api/v5/market/ticker") {
      const instId = parsed.searchParams.get("instId");
      return jsonResponse([
        {
          instId,
          last: instId === "yes-asset" ? "0.64" : "0.36",
          bidPx: "0.63",
          askPx: "0.65",
          vol24h: "1234",
          ts: "1781763600000"
        }
      ]);
    }

    if (parsed.pathname === "/api/v5/market/candles") {
      return jsonResponse([
        ["1781760000000", "0.60", "0.66", "0.59", "0.64", "100"],
        ["1781756400000", "0.58", "0.61", "0.57", "0.60", "88"]
      ]);
    }

    if (parsed.pathname === "/api/v5/market/pm-books") {
      return jsonResponse([
        {
          instId: parsed.searchParams.get("instId"),
          bids: [["0.63", "100"]],
          asks: [["0.65", "90"]],
          ts: "1781763600000"
        }
      ]);
    }

    throw new Error(`Unexpected OKX smoke URL: ${url}`);
  };

  try {
    const { getOkxOutcomeMarketData } = await import("../execution/okx-outcomes-client.ts");
    const data = await getOkxOutcomeMarketData("smoke-market", {
      includeCandles: true,
      includeOrderBook: true,
      candleBar: "1H",
      candleLimit: 2,
      bookSize: 5
    });

    assert(data.market?.marketId === "smoke-market", "reads single OKX market detail");
    assert(data.market?.yesAssetId === "yes-asset", "market detail exposes YES asset");
    assert(data.market?.noAssetId === "no-asset", "market detail exposes NO asset");
    assert(data.yesTicker?.last === 0.64, "reads YES ticker");
    assert(data.noTicker?.last === 0.36, "reads NO ticker");
    assert(data.yesCandles?.length === 2, "reads YES candles");
    assert(data.noCandles?.length === 2, "reads NO candles");
    assert(data.yesOrderBook?.bids[0]?.price === 0.63, "reads YES order book");
    assert(data.noOrderBook?.asks[0]?.size === 90, "reads NO order book");
    assert(calls.length === 7, "market data uses detail, ticker, candles, and order book endpoints");
    assert(calls.every((call) => call.method === "GET"), "OKX market data client stays GET-only");
    assert(calls.every((call) => call.hasKey && call.hasSignature && call.hasTimestamp && call.hasPassphrase), "OKX read-only calls are signed");
    assert(calls.some((call) => call.path === "/api/v5/predictions/markets/smoke-market"), "calls single market endpoint");
    assert(calls.some((call) => call.path === "/api/v5/market/ticker" && call.search.includes("instId=yes-asset")), "calls ticker endpoint");
    assert(calls.some((call) => call.path === "/api/v5/market/candles" && call.search.includes("bar=1H")), "calls candles endpoint");
    assert(calls.some((call) => call.path === "/api/v5/market/pm-books" && call.search.includes("sz=5")), "calls pm-books endpoint");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(originalEnv);
  }
}

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { code: "0", data };
    }
  };
}

function restoreEnv(originalEnv) {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
