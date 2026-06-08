const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `smoke-user-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = "0x1111111111111111111111111111111111111111";

const checks = [];

const home = await getJson(
  `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`
);
assert(home.home?.type === "mobile_home_view", "home returns mobile_home_view");
assert(home.home?.shell?.main === "premium_ai_conversation", "home shell is AI conversation");
assert(Array.isArray(home.home?.quickPrompts) && home.home.quickPrompts.length > 0, "home has quick prompts");
assert(home.home?.panels?.topRight?.walletLabel === "0x1111...1111", "home uses provided wallet address");

const explore = await getJson("/api/v2/world-cup/explore");
assert(explore.explore?.type === "world_cup_explore_view", "world cup explore returns view");
assert(Array.isArray(explore.explore?.categories), "world cup explore has categories");
assert(explore.explore?.cards?.champion !== undefined, "world cup explore has champion bucket");
const selectedWorldCupMarket = explore.explore?.cards?.champion?.[0]?.market;
assert(Boolean(selectedWorldCupMarket?.marketId), "world cup explore exposes selectable market");

const recharge = await postJson("/api/v2/phase-one", {
  text: "我要充值500U",
  walletAddress,
  userId
});
assert(recharge.mobileTurn?.goalType === "wallet_receive", "recharge returns wallet_receive turn");
const receiveCard = recharge.mobileTurn.cards.find((card) => card.type === "receive_card");
assert(receiveCard?.addresses?.length === 1, "recharge returns exactly one receive address");
assert(receiveCard?.addresses?.[0]?.address === walletAddress, "recharge uses provided wallet address");

const prediction = await postJson("/api/v2/phase-one", {
  text: "帮我看看世界杯有没有机会",
  userId
});
assert(prediction.mobileTurn?.goalType === "prediction_market_research", "prediction returns research turn");
const predictionCard = prediction.mobileTurn.cards.find((card) => card.type === "prediction_card");
assert(Boolean(predictionCard?.market), "prediction returns a market card");

const selectedPrediction = await postJson("/api/v2/phase-one", {
  text: `帮我继续分析：${selectedWorldCupMarket.question}`,
  candidateMarket: selectedWorldCupMarket,
  userId
});
const selectedPredictionCard = selectedPrediction.mobileTurn.cards.find((card) => card.type === "prediction_card");
assert(
  selectedPredictionCard?.market?.marketId === selectedWorldCupMarket.marketId,
  "prediction can analyze selected world cup market"
);
assert(selectedPredictionCard?.title?.includes("世界杯"), "selected prediction card uses friendly world cup title");
assert(!/^Will /i.test(selectedPredictionCard?.title || ""), "selected prediction card title is not raw English");
assert(selectedPredictionCard?.metrics?.priceLabel?.includes("会"), "selected prediction card uses friendly price labels");

const trackIdempotencyKey = `track-${userId}-${predictionCard.market.marketId}`;
const track = await postJson("/api/v2/phase-one/actions", {
  action: "track",
  market: predictionCard.market,
  idempotencyKey: trackIdempotencyKey,
  userId
});
assert(track.record?.type === "tracking.saved", "track writes tracking record");
assert(track.mobileTurn?.messages?.some((message) => message.card?.type === "tracking_card"), "track returns tracking mobile card");
assert(track.card?.title?.includes("世界杯") || track.card?.market?.provider !== "okx-outcomes", "tracking card keeps friendly world cup title");

const duplicateTrack = await postJson("/api/v2/phase-one/actions", {
  action: "track",
  market: predictionCard.market,
  idempotencyKey: trackIdempotencyKey,
  userId
});
assert(duplicateTrack.record?.id === track.record.id, "track idempotency returns existing record");
assert(duplicateTrack.idempotent === true, "track idempotency marks duplicate response");

const strategy = await postJson("/api/v2/phase-one/actions", {
  action: "build_strategy",
  market: predictionCard.market,
  userId
});
assert(strategy.record?.type === "strategy.saved", "build_strategy writes strategy record");
assert(strategy.mobileTurn?.messages?.some((message) => message.card?.type === "strategy_card"), "build_strategy returns strategy mobile card");
assert(strategy.card?.title?.includes("世界杯") || strategy.card?.market?.provider !== "okx-outcomes", "strategy card keeps friendly world cup title");

const simulate = await postJson("/api/v2/phase-one/actions", {
  action: "simulate",
  market: predictionCard.market,
  amountUsd: 1,
  userId
});
assert(simulate.record?.type === "simulation.saved", "simulate writes simulation record");
assert(simulate.result?.status === "dry_run_completed", "simulate completes dry-run");
assert(simulate.card?.agentNote?.includes("订单没有提交"), "simulation card keeps no-order boundary");

const [ownRecords, otherRecords, tracking, strategies] = await Promise.all([
  getJson(`/api/v2/phase-one/records?userId=${encodeURIComponent(userId)}`),
  getJson(`/api/v2/phase-one/records?userId=${encodeURIComponent(otherUserId)}`),
  getJson(`/api/v2/phase-one/tracking?userId=${encodeURIComponent(userId)}`),
  getJson(`/api/v2/phase-one/strategies?userId=${encodeURIComponent(userId)}`)
]);

assert(ownRecords.items.length >= 3, "current user sees own records");
assert(otherRecords.items.length === 0, "other user sees no records");
assert(tracking.items.length >= 1, "tracking endpoint returns item");
assert(strategies.items.length >= 1, "strategies endpoint returns item");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  userId,
  checks,
  market: predictionCard.market.question,
  records: ownRecords.items.length
}, null, 2));

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return readJsonResponse(response, path);
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return readJsonResponse(response, path);
}

async function readJsonResponse(response, path) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.error || ""}`.trim());
  }
  return data;
}

function assert(condition, label) {
  if (!condition) throw new Error(`Smoke check failed: ${label}`);
  checks.push(label);
}
