import {
  findPhaseOneRecordByIdempotencyKey,
  listPhaseOneRecords,
  listPredictionCards,
  listStrategyCards,
  listTrackingCards,
  savePhaseOneRecord
} from "../storage/phase-one-store.ts";

process.env.HWALLET_SESSION_STORE = "jsonl";

const userId = `phase-one-store-boundary-${Date.now()}`;
const otherUserId = `${userId}-other`;
const idempotencyKey = `track-${userId}`;

const trackingCard = {
  id: `tracking-${userId}`,
  type: "tracking_card",
  title: "真实用户跟踪记录",
  agentNote: "仅记录真实用户的跟踪卡片。",
  market: {
    provider: "okx-outcomes",
    chainId: 196,
    marketId: "xlayer-real-market",
    question: "真实市场是否可观察？",
    acceptingOrders: false,
    yesPrice: 0.42
  }
};

const strategyCard = {
  id: `strategy-${userId}`,
  type: "strategy_card",
  title: "真实用户策略记录",
  agentNote: "仅记录真实用户的策略草案。"
};

const predictionCard = {
  id: `prediction-${userId}`,
  type: "prediction_card",
  title: "真实用户预测记录",
  agentNote: "仅记录真实用户的预测卡。"
};

const trackingRecord = await savePhaseOneRecord({
  userId,
  idempotencyKey,
  type: "tracking.saved",
  title: trackingCard.title,
  note: trackingCard.agentNote,
  card: trackingCard
});
const duplicate = await savePhaseOneRecord({
  userId,
  idempotencyKey,
  type: "tracking.saved",
  title: "重复跟踪记录",
  note: "should return existing record",
  card: trackingCard
});
await savePhaseOneRecord({
  userId,
  type: "strategy.saved",
  title: strategyCard.title,
  note: strategyCard.agentNote,
  card: strategyCard
});
await savePhaseOneRecord({
  userId,
  type: "prediction.saved",
  title: predictionCard.title,
  note: predictionCard.agentNote,
  card: predictionCard
});

const records = await listPhaseOneRecords(userId);
const otherRecords = await listPhaseOneRecords(otherUserId);
const found = await findPhaseOneRecordByIdempotencyKey(userId, idempotencyKey);
const trackingCards = await listTrackingCards(userId);
const strategyCards = await listStrategyCards(userId);
const predictionCards = await listPredictionCards(userId);
const missingSaveUserRejected = await rejectsWithPhaseOneUserBoundary(() => savePhaseOneRecord({
  userId: "",
  type: "tracking.saved",
  title: "missing user should fail",
  note: "missing user should not write a record",
  card: trackingCard
}));
const missingListUserRejected = await rejectsWithPhaseOneUserBoundary(() => listPhaseOneRecords(" "));
const missingFindUserRejected = await rejectsWithPhaseOneUserBoundary(() => findPhaseOneRecordByIdempotencyKey("", idempotencyKey));
const missingTrackingUserRejected = await rejectsWithPhaseOneUserBoundary(() => listTrackingCards(""));
const missingPredictionUserRejected = await rejectsWithPhaseOneUserBoundary(() => listPredictionCards(""));
const missingStrategyUserRejected = await rejectsWithPhaseOneUserBoundary(() => listStrategyCards(""));

assert(trackingRecord.userId === userId, "saved record keeps required user id");
assert(duplicate.id === trackingRecord.id, "idempotency returns existing user-scoped record");
assert(found?.id === trackingRecord.id, "find by idempotency is user scoped");
assert(records.some((record) => record.id === trackingRecord.id), "lists current user's records");
assert(records.every((record) => record.userId === userId), "listed records stay scoped to user");
assert(otherRecords.length === 0, "other user records are isolated");
assert(trackingCards.some((card) => card.id === trackingCard.id), "tracking cards restored for user");
assert(strategyCards.some((card) => card.id === strategyCard.id), "strategy cards restored for user");
assert(predictionCards.some((card) => card.id === predictionCard.id), "prediction cards restored for user");
assert(missingSaveUserRejected, "missing save user is rejected");
assert(missingListUserRejected, "missing list user is rejected");
assert(missingFindUserRejected, "missing find user is rejected");
assert(missingTrackingUserRejected, "missing tracking user is rejected");
assert(missingPredictionUserRejected, "missing prediction user is rejected");
assert(missingStrategyUserRejected, "missing strategy user is rejected");

console.log(JSON.stringify({
  ok: true,
  userId,
  checks: [
    "record writes require user id",
    "idempotency stays user scoped",
    "record lists require user id",
    "card lists require user id",
    "other user isolated",
    "missing user rejected"
  ],
  recordId: trackingRecord.id
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Phase One store boundary smoke failed: ${label}`);
}

async function rejectsWithPhaseOneUserBoundary(callback) {
  try {
    await callback();
    return false;
  } catch (error) {
    return error instanceof Error && error.message === "Phase One record userId is required";
  }
}
