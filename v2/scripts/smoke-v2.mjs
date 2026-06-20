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
assert(home.wallet?.address === walletAddress, "home returns wallet context for current user");
assert(home.wallet?.chainId === 196, "home wallet context uses X Layer");
assert(home.wallet?.assets?.some((asset) => asset.symbol === "USDT0"), "home wallet context includes USDT0 asset slot");
assert(home.wallet?.assets?.some((asset) => asset.symbol === "USDT"), "home wallet context includes legacy USDT asset slot");
assert(home.wallet?.assets?.some((asset) => asset.symbol === "OKB"), "home wallet context includes OKB asset slot");
assert(Array.isArray(home.wallet?.recentRecords), "home wallet context includes recent wallet records");
assert(Boolean(home.wallet?.agent?.fundsStatus), "home wallet context includes Agent fund status");
assert(Boolean(home.wallet?.agent?.nextActionText), "home wallet context includes Agent next action");
assert(home.wallet?.vault?.title === "Agent 资金池", "home wallet context includes Agent vault state");
assert(home.wallet?.vault?.userVisibleAddress === false, "home wallet vault does not expose strategy address");
assert(home.wallet?.policy?.liveExecutionEnabled === false, "home wallet policy keeps live execution disabled");
const walletOnly = await getJson(
  `/api/v2/mobile/wallet?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`
);
assert(walletOnly.wallet?.address === walletAddress, "wallet endpoint returns current HWallet");
assert(walletOnly.wallet?.policy?.liveExecutionEnabled === false, "wallet endpoint keeps live execution disabled");
const deviceEvidence = await postJson("/api/v2/mobile/device-evidence", {
  userId,
  walletAddress,
  environment: {
    platform: "ios",
    buildChannel: "preview",
    apiBaseUrl: baseUrl,
    appVersion: "0.1.0",
    buildNumber: "9"
  },
  checks: {
    appOpensWithoutCrash: true,
    hWalletVisible: true,
    receiveAddressVisible: true,
    copyFeedbackVisible: true,
    noWrongUserDataExposure: true,
    liveExecutionClosed: true
  },
  artifacts: [
    {
      label: "h-wallet-copy-feedback",
      redacted: true
    }
  ]
});
assert(deviceEvidence.ok === true, "device evidence endpoint accepts authenticated App proof");
assert(deviceEvidence.evidence?.redacted === true, "device evidence response stays redacted");
assert(deviceEvidence.evidence?.walletAddress === "0x1111...111111", "device evidence redacts wallet address");
const conflictingWallet = await getStatus(
  `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent("0x2222222222222222222222222222222222222222")}`
);
assert(conflictingWallet.status === 409, "same user cannot replace bound HWallet address");
assert(Array.isArray(home.home?.recent?.tracking), "home returns recent tracking list");
assert(Array.isArray(home.home?.recent?.strategies), "home returns recent strategy list");
assert(Array.isArray(home.home?.recent?.records), "home returns recent record list");

const explore = await getJson("/api/v2/prediction/explore?mode=sample");
assert(explore.explore?.type === "world_cup_explore_view", "prediction explore returns view");
assert(Boolean(explore.explore?.source?.label), "prediction explore returns friendly source label");
assert(Boolean(explore.explore?.source?.message), "prediction explore returns friendly source message");
assert(explore.explore?.source?.mode === "sample", "prediction explore only returns sample data when sample mode is explicit");
assert(Array.isArray(explore.explore?.categories), "prediction explore has categories");
assert(explore.explore?.cards?.champion !== undefined, "prediction explore has champion bucket");
assert(explore.explore?.cards?.upcoming_matches !== undefined, "prediction explore has match bucket");
assert(explore.explore?.summary?.categoryCounts?.upcoming_matches >= 1, "prediction explore keeps upcoming matches visible");
const selectedWorldCupCard = explore.explore?.cards?.champion?.[0];
const selectedWorldCupMarket = selectedWorldCupCard?.marketRef;
assert(Boolean(selectedWorldCupMarket?.marketId), "prediction explore exposes selectable market");
assert(selectedWorldCupMarket?.readOnly === true, "prediction explore selectable market is read-only");
assert(!("market" in (selectedWorldCupCard || {})), "prediction explore does not expose raw market snapshot");

const legacyExplore = await getJson("/api/v2/world-cup/explore");
assert(legacyExplore.explore?.type === "world_cup_explore_view", "legacy world cup explore remains compatible");

const liveModeExplore = await getJson("/api/v2/prediction/explore?mode=live");
assert(liveModeExplore.explore?.type === "world_cup_explore_view", "prediction live mode returns view");
assert(liveModeExplore.explore?.source?.mode !== "sample", "prediction live mode does not return sample data");
if (liveModeExplore.explore?.source?.mode === "unavailable") {
  assert(liveModeExplore.explore?.summary?.totalMarkets === 0, "prediction unavailable live mode returns no fake markets");
  assert(Boolean(liveModeExplore.explore?.source?.warning), "prediction unavailable live mode explains missing real data");
}

const recharge = await postJson("/api/v2/phase-one", {
  text: "我要充值500U",
  walletAddress,
  userId
});
assert(recharge.mobileTurn?.goalType === "wallet_receive", "recharge returns wallet_receive turn");
assert(recharge.wallet?.address === walletAddress, "recharge chat returns current wallet");
const receiveCard = recharge.mobileTurn.cards.find((card) => card.type === "receive_card");
assert(receiveCard?.addresses?.length === 1, "recharge returns exactly one receive address");
assert(receiveCard?.addresses?.[0]?.address === walletAddress, "recharge uses provided wallet address");

const walletStatus = await postJson("/api/v2/phase-one", {
  text: "我的钱包状态怎么样",
  walletAddress,
  userId
});
assert(walletStatus.mobileTurn?.goalType === "wallet_status", "wallet status returns wallet_status turn");
assert(walletStatus.wallet?.address === walletAddress, "wallet status chat returns current wallet");
assert(walletStatus.orchestration?.action === "check_wallet_funds", "wallet status returns orchestration action");
assert(walletStatus.orchestration?.capability?.onchainSkill?.status === "not_needed", "wallet status does not call Onchain Skill");
assert(
  walletStatus.mobileTurn?.messages?.some((message) => message.text?.includes("HWallet")),
  "wallet status uses friendly HWallet copy"
);

const walletRefresh = await postJson("/api/v2/mobile/wallet/refresh", {
  walletAddress,
  userId
});
assert(walletRefresh.wallet?.address === walletAddress, "wallet refresh returns current wallet");
assert(Boolean(walletRefresh.wallet?.agent?.fundsStatus), "wallet refresh returns Agent fund state");
assert(walletRefresh.wallet?.vault?.title === "Agent 资金池", "wallet refresh returns Agent vault state");
assert(walletRefresh.wallet?.policy?.liveExecutionEnabled === false, "wallet refresh returns Agent policy state");
assert(Boolean(walletRefresh.orchestration?.action), "wallet refresh returns Agent orchestration");
assert(walletRefresh.orchestration?.capability?.liveExecution?.enabled === false, "wallet refresh orchestration keeps live execution disabled");
if (walletRefresh.wallet?.agent?.fundsStatus === "ready") {
  assert(walletRefresh.mobileTurn?.goalType === "prediction_market_research", "funded wallet refresh enters prediction research");
  assert(walletRefresh.orchestration?.action === "analyze_worldcup_market", "funded wallet refresh returns market-analysis orchestration");
} else {
  assert(walletRefresh.mobileTurn?.goalType === "agent_fund_prepare", "unfunded wallet refresh returns fund-preparation turn");
  assert(walletRefresh.orchestration?.action === "check_wallet_funds", "unfunded wallet refresh returns wallet-check orchestration");
}
assert(
  walletRefresh.mobileTurn?.messages?.some((message) => /到账|资产|刷新|HWallet|观察|模拟/.test(message.text || "")),
  "wallet refresh replies with wallet recognition copy"
);
assert(
  walletRefresh.mobileTurn?.messages?.some((message) => /不开放真实下单|真实下单/.test(message.text || "")),
  "wallet refresh replies with live-execution boundary"
);
const auditAfterWalletRefresh = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}`);
assert(
  auditAfterWalletRefresh.events?.some((event) => event.type === "device.evidence" && event.moneyMoved === false),
  "audit timeline records device evidence without money movement"
);
assert(
  auditAfterWalletRefresh.events?.some((event) => event.type === "wallet.refresh" && event.moneyMoved === false),
  "audit timeline records wallet refresh without money movement"
);
assert(
  auditAfterWalletRefresh.events?.some((event) => event.type === "wallet.refresh" && Boolean(event.walletRecordId)),
  "audit timeline links wallet refresh to wallet record"
);
assert(
  auditAfterWalletRefresh.events?.some((event) => event.type === "wallet.refresh" && event.walletRecord?.id === event.walletRecordId),
  "audit timeline returns wallet refresh record"
);

const fundReady = await postJson("/api/v2/phase-one", {
  text: "好了，我充完了",
  walletAddress,
  userId
});
if (walletRefresh.wallet?.agent?.fundsStatus === "ready") {
  assert(fundReady.mobileTurn?.goalType === "prediction_market_research", "fund-ready copy enters prediction research when funds are ready");
} else {
  assert(fundReady.mobileTurn?.goalType === "agent_fund_prepare", "fund-ready copy returns agent_fund_prepare turn when funds are not ready");
}
assert(
  fundReady.mobileTurn?.messages?.some((message) => /到账|资产|刷新|观察|模拟/.test(message.text || "")),
  "fund-ready turn replies with wallet sync status"
);
assert(fundReady.wallet?.address === walletAddress, "fund-ready chat returns current wallet");
assert(fundReady.orchestration?.capability?.liveExecution?.enabled === false, "fund-ready orchestration keeps live execution disabled");

const prediction = await postJson("/api/v2/phase-one", {
  text: "帮我看看世界杯有没有机会",
  userId
});
assert(prediction.mobileTurn?.goalType === "prediction_market_research", "prediction returns research turn");
assert(prediction.orchestration?.action === "analyze_worldcup_market", "prediction returns orchestration action");
assert(prediction.orchestration?.capability?.onchainSkill?.mode === "observe", "prediction orchestration uses observe mode");
assert(prediction.orchestration?.capability?.liveExecution?.enabled === false, "prediction orchestration keeps live execution disabled");
const predictionCard = prediction.mobileTurn.cards.find((card) => card.type === "prediction_card");
if (predictionCard?.market) {
  assert(predictionCard.market.provider !== "local-sample", "prediction does not use a local sample fallback");
  assert(!String(predictionCard.market.marketId || "").startsWith("sample-"), "prediction market is not a sample id");
} else {
  assert(
    prediction.mobileTurn?.messages?.some((message) => /真实预测市场数据|不生成行情卡|稍后刷新/.test(message.text || "")),
    "prediction explains when real market data is unavailable"
  );
}
const auditAfterPrediction = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}`);
assert(
  auditAfterPrediction.events?.some((event) => event.type === "prediction.analyzed" && event.moneyMoved === false),
  "audit timeline records prediction analysis without money movement"
);
if (predictionCard?.market) {
  assert(
    auditAfterPrediction.events?.some((event) => event.type === "prediction.analyzed" && event.card?.type === "prediction_card"),
    "audit timeline links prediction analysis back to its card"
  );
  assert(
    auditAfterPrediction.events?.some((event) => event.type === "prediction.analyzed" && Boolean(event.recordId)),
    "audit timeline links prediction analysis to a record id"
  );
} else {
  assert(
    !auditAfterPrediction.events?.some((event) => event.type === "prediction.analyzed" && event.card?.market?.marketId?.startsWith?.("sample-")),
    "audit timeline does not link unavailable real-data analysis to a sample market card"
  );
}
const memoryAfterPrediction = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(userId)}`);
assert(memoryAfterPrediction.memory?.type === "mobile_agent_memory", "memory endpoint returns mobile memory");
assert(memoryAfterPrediction.memory?.counters?.chatTurns >= 1, "memory endpoint records chat turns");
assert(
  memoryAfterPrediction.memory?.recentMessages?.some((message) => message.role === "user" && /世界杯/.test(message.text)),
  "memory endpoint records recent user message"
);
assert(
  memoryAfterPrediction.memory?.knowledgeNotes?.some((note) => /X Layer|真实下单|充值/.test(note)),
  "memory endpoint records wallet knowledge notes"
);

const executeLikeReply = await postJson("/api/v2/phase-one", {
  text: "买西班牙冠军 500U",
  walletAddress,
  userId
});
assert(executeLikeReply.mobileTurn?.goalType === "prediction_market_research", "execute-like copy stays in research mode");
assert(executeLikeReply.orchestration?.action === "analyze_worldcup_market", "execute-like copy routes to analysis");
assert(executeLikeReply.orchestration?.capability?.liveExecution?.enabled === false, "execute-like copy keeps live execution disabled");
assert(
  executeLikeReply.mobileTurn?.messages?.some((message) => /只做分析和模拟|不会真实下单/.test(message.text || "")),
  "execute-like mobile reply explains no live order"
);

const otherMemory = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(otherUserId)}`);
assert(otherMemory.memory?.recentMessages?.length === 0, "memory endpoint isolates other users");

const selectedPrediction = await postJson("/api/v2/phase-one", {
  text: `帮我继续分析：${selectedWorldCupMarket.question}`,
  candidateMarket: selectedWorldCupMarket,
  userId
});
const selectedProgressText = selectedPrediction.mobileTurn.messages
  .filter((message) => message.kind === "progress")
  .map((message) => message.text)
  .join(" ");
const selectedPredictionCard = selectedPrediction.mobileTurn.cards.find((card) => card.type === "prediction_card");
assert(
  selectedPredictionCard?.market?.marketId === selectedWorldCupMarket.marketId,
  "prediction can analyze selected world cup market"
);
const actionMarket = selectedPredictionCard?.market;
assert(Boolean(actionMarket), "selected prediction returns an action market");
assert(selectedProgressText.includes("我先看这场的价格和热度"), "selected market uses friendly analysis progress");
assert(!selectedPrediction.mobileTurn.messages.some((message) => message.text === "我先整理成一张策略卡，你可以先模拟。"), "selected market avoids old strategy-card wording");
assert(selectedPredictionCard?.title?.includes("世界杯"), "selected prediction card uses friendly world cup title");
assert(!/^Will /i.test(selectedPredictionCard?.title || ""), "selected prediction card title is not raw English");
assert(selectedPredictionCard?.metrics?.priceLabel?.includes("会"), "selected prediction card uses friendly price labels");

const trackIdempotencyKey = `track-${userId}-${actionMarket.marketId}`;
const track = await postJson("/api/v2/phase-one/actions", {
  action: "track",
  market: actionMarket,
  idempotencyKey: trackIdempotencyKey,
  userId
});
assert(track.record?.type === "tracking.saved", "track writes tracking record");
assert(track.mobileTurn?.messages?.some((message) => message.card?.type === "tracking_card"), "track returns tracking mobile card");
assert(track.card?.title?.includes("世界杯") || track.card?.market?.provider !== "okx-outcomes", "tracking card keeps friendly world cup title");
const auditAfterTracking = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}`);
assert(
  auditAfterTracking.events?.some((event) => event.type === "tracking.saved" && event.moneyMoved === false),
  "audit timeline records tracking without money movement"
);
assert(
  auditAfterTracking.events?.some((event) => event.type === "tracking.saved" && event.card?.type === "tracking_card"),
  "audit timeline links tracking record card"
);
assert(
  auditAfterTracking.events?.some((event) => event.type === "tracking.saved" && event.recordId === track.record.id),
  "audit timeline links tracking to the exact record id"
);

const duplicateTrack = await postJson("/api/v2/phase-one/actions", {
  action: "track",
  market: actionMarket,
  idempotencyKey: trackIdempotencyKey,
  userId
});
assert(duplicateTrack.record?.id === track.record.id, "track idempotency returns existing record");
assert(duplicateTrack.idempotent === true, "track idempotency marks duplicate response");

const strategy = await postJson("/api/v2/phase-one/actions", {
  action: "build_strategy",
  market: actionMarket,
  userId
});
assert(strategy.record?.type === "strategy.saved", "build_strategy writes strategy record");
assert(strategy.mobileTurn?.messages?.some((message) => message.card?.type === "strategy_card"), "build_strategy returns strategy mobile card");
assert(strategy.card?.title?.includes("世界杯") || strategy.card?.market?.provider !== "okx-outcomes", "strategy card keeps friendly world cup title");

const simulate = await postJson("/api/v2/phase-one/actions", {
  action: "simulate",
  market: actionMarket,
  amountUsd: 1,
  userId
});
assert(simulate.record?.type === "simulation.saved", "simulate writes simulation record");
assert(simulate.result?.status === "dry_run_completed", "simulate completes dry-run");
assert(simulate.card?.agentNote?.includes("订单没有提交"), "simulation card keeps no-order boundary");
assert(simulate.card?.moneyMoved === false, "simulation card explicitly records no money movement");
assert(Boolean(simulate.card?.sideLabel), "simulation card includes side label");
assert(simulate.card?.market?.marketId === actionMarket.marketId, "simulation card keeps market for next action");
if (actionMarket.provider === "okx-outcomes") {
  assert(simulate.result?.raw?.provider === "okx-outcomes", "OKX simulation keeps OKX provider");
  assert(simulate.result?.raw?.route === "outcomes.order.preview", "OKX simulation uses OKX preview route");
  assert(simulate.result?.raw?.moneyMoved === false, "OKX simulation cannot move money");
  assert(simulate.result?.raw?.liveExecutionEnabled === false, "OKX simulation keeps live execution closed");
  assert(simulate.card?.agentNote?.includes("OKX Outcomes 本地模拟预览"), "OKX simulation card uses OKX preview copy");
}
const auditAfterSimulation = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}`);
const simulationAudit = auditAfterSimulation.events?.find((event) => event.type === "simulation.completed");
assert(simulationAudit?.moneyMoved === false, "audit timeline records simulation without money movement");
assert(simulationAudit?.recordId === simulate.record.id, "audit timeline links simulation to the exact record id");
assert(Boolean(simulationAudit?.amountLabel), "audit timeline records simulation amount");
assert(Boolean(simulationAudit?.simulationSide), "audit timeline records simulation side");
const trackFromSimulation = await postJson("/api/v2/phase-one/actions", {
  action: "track",
  market: simulate.card.market,
  idempotencyKey: `track-from-simulation-${userId}-${simulate.card.market.marketId}`,
  userId
});
assert(trackFromSimulation.record?.type === "tracking.saved", "simulation card can continue into tracking");

const okxSimulationMarket = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "okx-smoke-event",
  marketId: `okx-smoke-market-${userId}`,
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  status: "active",
  marketType: "binary",
  yesAssetId: "yes-asset-redacted",
  noAssetId: "no-asset-redacted",
  yesPrice: 0.17,
  noPrice: 0.83,
  acceptingOrders: true,
  liquidity: 4210,
  volume24h: 988
};
const okxSimulation = await postJson("/api/v2/phase-one/actions", {
  action: "simulate",
  market: okxSimulationMarket,
  amountUsd: 3,
  userId
});
assert(okxSimulation.result?.status === "dry_run_completed", "OKX simulation completes dry-run");
assert(okxSimulation.result?.raw?.provider === "okx-outcomes", "OKX simulation keeps OKX provider");
assert(okxSimulation.result?.raw?.route === "outcomes.order.preview", "OKX simulation uses OKX preview route");
assert(okxSimulation.result?.raw?.moneyMoved === false, "OKX simulation cannot move money");
assert(okxSimulation.result?.raw?.liveExecutionEnabled === false, "OKX simulation keeps live execution closed");
assert(okxSimulation.card?.agentNote?.includes("OKX Outcomes 本地模拟预览"), "OKX simulation card uses OKX preview copy");
assert(okxSimulation.card?.moneyMoved === false, "OKX simulation card records no money movement");

const blockedSimulation = await postStatus("/api/v2/phase-one/actions", {
  action: "simulate",
  market: actionMarket,
  amountUsd: 101,
  userId
});
assert(blockedSimulation.status === 403, "oversized simulation is blocked by policy");
assert(blockedSimulation.data?.decision?.status === "block", "blocked action returns policy decision");
const auditAfterPolicyBlock = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}`);
const policyBlockedAudit = auditAfterPolicyBlock.events?.find((event) => event.type === "policy.blocked");
assert(policyBlockedAudit?.moneyMoved === false, "policy block audit records no money movement");
assert(policyBlockedAudit?.marketId === actionMarket.marketId, "policy block audit links market");

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
  market: actionMarket.question,
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

async function getStatus(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data
  };
}

async function postStatus(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data
  };
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
