import {
  createScopedV2AgentWalletSession,
  createV2AgentWalletScopeKey,
  getLatestV2Card,
  initialV2AgentWalletSession,
  isV2AgentWalletSessionScope,
  loadV2AgentWalletState,
  refreshV2AgentWallet,
  runV2AgentWalletCardAction,
  sendV2AgentWalletText,
  verifyV2AgentWalletTx
} from "./v2-session";
import type { V2AgentOrchestration, V2MarketSnapshot, V2MobileAgentMemory, V2MobileChatTurn, V2WalletContext } from "./types";

const predictionTurn: V2MobileChatTurn = {
  type: "mobile_chat_turn",
  id: "turn-1",
  goalType: "prediction_market_research",
  createdAt: "2026-06-08T00:00:00.000Z",
  suggestedInput: "先模拟一下",
  cards: [
    {
      type: "prediction_card",
      id: "card-1",
      title: "Will example win?",
      statusText: "可以继续看",
      agentNote: "先模拟。",
      market: {
        provider: "polymarket-plugin",
        chainId: 137,
        marketId: "market-1",
        question: "Will example win?",
        acceptingOrders: true,
        yesPrice: 0.1
      },
      metrics: {},
      suggestedAction: "先模拟",
      actions: ["simulate", "track", "build_strategy"],
      createdAt: "2026-06-08T00:00:00.000Z"
    }
  ],
  messages: [
    {
      id: "m1",
      role: "user",
      kind: "text",
      text: "世界杯预测",
      createdAt: "2026-06-08T00:00:00.000Z"
    },
    {
      id: "m2",
      role: "agent",
      kind: "card",
      card: {
        type: "prediction_card",
        id: "card-1",
        title: "Will example win?",
        statusText: "可以继续看",
        agentNote: "先模拟。",
        market: {
          provider: "polymarket-plugin",
          chainId: 137,
          marketId: "market-1",
          question: "Will example win?",
          acceptingOrders: true,
          yesPrice: 0.1
        },
        metrics: {},
        suggestedAction: "先模拟",
        actions: ["simulate", "track", "build_strategy"],
        createdAt: "2026-06-08T00:00:00.000Z"
      },
      actions: [{ id: "simulate", label: "先模拟" }],
      createdAt: "2026-06-08T00:00:00.000Z"
    }
  ]
};

const actionTurn: V2MobileChatTurn = {
  type: "mobile_chat_turn",
  id: "turn-2",
  goalType: "prediction_market_dry_run",
  createdAt: "2026-06-08T00:01:00.000Z",
  cards: [],
  messages: [
    {
      id: "m3",
      role: "agent",
      kind: "text",
      text: "模拟完成，可以继续观察。",
      createdAt: "2026-06-08T00:01:00.000Z"
    }
  ]
};

const walletTurn: V2MobileChatTurn = {
  type: "mobile_chat_turn",
  id: "turn-wallet",
  goalType: "wallet_tx_verify",
  createdAt: "2026-06-08T00:03:00.000Z",
  cards: [],
  messages: [
    {
      id: "m-wallet",
      role: "agent",
      kind: "text",
      text: "这笔已到账，HWallet 已更新。",
      createdAt: "2026-06-08T00:03:00.000Z"
    }
  ]
};

let receivedCandidateMarketId: string | undefined;

const predictionOrchestration: V2AgentOrchestration = {
  action: "analyze_worldcup_market",
  goalType: "prediction_market_research",
  progressHint: "读取市场并生成预测卡",
  capability: {
    walletReady: true,
    fundsReady: true,
    needsWallet: true,
    needsFunds: false,
    onchainSkill: {
      status: "allowed",
      mode: "observe",
      capability: "okx-onchainos-skills",
      reason: "可以调用 Onchain Skill 做数据读取或模拟，仍不开放真实下单。"
    },
    liveExecution: {
      enabled: false,
      reason: "MVP 阶段关闭真实下单，Agent 只做分析、跟踪和模拟。"
    },
    policyDecision: {
      status: "allow",
      action: "analyze",
      reason: "Policy allow",
      userText: "第一版只允许分析、跟踪和模拟，不开放真实下单。",
      policy: {
        id: "agent-policy-mvp-observe-only",
        mode: "mvp_observe_only",
        allowedActions: ["analyze", "track", "build_strategy", "simulate"],
        liveExecutionEnabled: false,
        maxSimulationUsd: 100,
        allowedProviders: ["okx-outcomes", "polymarket-plugin"],
        allowedChains: [196, 137],
        policyText: "第一版只允许分析、跟踪和模拟，不开放真实下单。"
      }
    }
  }
};

const refreshedWallet: V2WalletContext = {
  userId: "demo-user",
  address: "0x1111111111111111111111111111111111111111",
  chainId: 196,
  network: "X Layer",
  assets: [],
  recentRecords: [
    {
      id: "wallet-record-refresh",
      title: "暂无新到账",
      note: "已刷新 X Layer 资产，余额暂时没有变化。",
      status: "synced",
      createdAt: "2026-06-08T00:02:00.000Z"
    }
  ],
  status: "ready",
  statusText: "HWallet 已经准备好。",
  agent: {
    mode: "observe_only",
    fundsStatus: "waiting",
    availableText: "暂未看到可用资金",
    nextActionText: "充值后 Agent 会识别到账状态。"
  },
  vault: {
    id: "agent-vault-smoke",
    title: "Agent 资金池",
    status: "waiting",
    displayText: "等待充值到账",
    policyText: "第一版只做分析、跟踪和模拟。",
    sourceText: "来自 HWallet 收款地址",
    userVisibleAddress: false
  },
  policy: {
    id: "agent-policy-mvp-observe-only",
    mode: "mvp_observe_only",
    allowedActions: ["analyze", "track", "build_strategy", "simulate"],
    liveExecutionEnabled: false,
    maxSimulationUsd: 100,
    allowedProviders: ["okx-outcomes", "polymarket-plugin"],
    allowedChains: [196, 137],
    policyText: "第一版只允许分析、跟踪和模拟，不开放真实下单。"
  }
};

const verifiedReadyWallet: V2WalletContext = {
  ...refreshedWallet,
  assets: [
    {
      symbol: "USDT0",
      name: "USD Tether 0",
      amountLabel: "0.053127",
      amountValue: "0.053127",
      valueLabel: "-",
      syncStatus: "synced"
    }
  ],
  recentRecords: [
    {
      id: "wallet-tx-0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
      title: "交易已确认到账",
      note: "0.053127 USDT0 已计入 HWallet，Agent 可以继续分析或模拟。",
      status: "synced",
      createdAt: "2026-06-08T00:03:00.000Z"
    }
  ],
  agent: {
    mode: "observe_only",
    fundsStatus: "ready",
    availableText: "0.053127 USDT0 可用于 Agent 分析和模拟",
    primaryAsset: "USDT0",
    nextActionText: "资金已到账，下一步可以让 Agent 看市场机会。"
  },
  vault: {
    id: "agent-vault-smoke",
    title: "Agent 资金池",
    status: "ready",
    displayText: "0.053127 USDT0 可用于 Agent 分析和模拟",
    policyText: "第一版只做分析、跟踪和模拟。",
    sourceText: "已识别新到账资金",
    userVisibleAddress: false
  }
};

const refreshedMemory: V2MobileAgentMemory = {
  type: "mobile_agent_memory",
  userId: "demo-user",
  source: "session_memory_v1",
  counters: {
    homeLoads: 1,
    chatTurns: 1
  },
  wallet: {
    address: refreshedWallet.address,
    chainId: 196,
    network: "X Layer",
    records: refreshedWallet.recentRecords,
    verifiedTransfers: []
  },
  recentMessages: [],
  knowledgeNotes: ["第一版只开放数据展示、充值收款、模拟和跟踪，不开放真实下单。"],
  updatedAt: "2026-06-08T00:02:00.000Z"
};

const refreshedHome = {
  type: "mobile_home_view" as const,
  shell: {
    main: "premium_ai_conversation" as const,
    entries: []
  },
  panels: {
    topLeft: {
      type: "world_cup_info_panel" as const,
      title: "市场",
      summary: "测试市场摘要",
      items: [],
      updatedAt: "2026-06-08T00:04:00.000Z"
    },
    topRight: {
      type: "user_console_panel" as const,
      title: "我的",
      walletLabel: "0x1111...1111",
      actions: [],
      updatedAt: "2026-06-08T00:04:00.000Z"
    }
  },
  state: {
    trackingCount: 1,
    strategyCount: 1,
    recordCount: 3
  },
  quickPrompts: [],
  recent: {
    tracking: [],
    strategies: [],
    records: [
      {
        id: "record-after-action",
        type: "simulation.saved",
        title: "模拟完成",
        note: "Agent 已保存模拟记录。",
        createdAt: "2026-06-08T00:01:00.000Z"
      }
    ]
  },
  updatedAt: "2026-06-08T00:04:00.000Z"
};

let actionHomeRefreshes = 0;

const api = {
  getV2Home: async () => {
    actionHomeRefreshes += 1;
    return {
      home: refreshedHome,
      wallet: refreshedWallet
    };
  },
  getV2Wallet: async () => refreshedWallet,
  getV2Memory: async () => refreshedMemory,
  sendV2Chat: async (_text: string, _userId?: string, _walletAddress?: `0x${string}`, candidateMarket?: V2MarketSnapshot) => {
    receivedCandidateMarketId = candidateMarket?.marketId;
    return { mobileTurn: predictionTurn, orchestration: predictionOrchestration };
  },
  refreshV2Wallet: async () => ({
    wallet: refreshedWallet,
    mobileTurn: actionTurn
  }),
  verifyV2WalletTx: async () => ({
    wallet: refreshedWallet,
    mobileTurn: actionTurn
  }),
  listV2Audit: async () => [
    {
      id: "audit-1",
      userId: "demo-user",
      type: "wallet.refresh" as const,
      title: "已检查 HWallet",
      note: "已刷新钱包状态，未发生资金动作。",
      status: "success" as const,
      moneyMoved: false as const,
      walletRecordId: refreshedWallet.recentRecords[0].id,
      walletRecord: refreshedWallet.recentRecords[0],
      createdAt: "2026-06-08T00:02:00.000Z"
    }
  ],
  runV2Action: async (input: { idempotencyKey?: string }) => {
    if (!input.idempotencyKey) throw new Error("Expected idempotency key.");
    return actionTurn;
  }
};

let walletGoalRefreshes = 0;
const walletGoalApi = {
  ...api,
  getV2Wallet: async () => {
    walletGoalRefreshes += 1;
    return refreshedWallet;
  },
  sendV2Chat: async () => ({
    mobileTurn: walletTurn,
    wallet: refreshedWallet
  })
};

let txHashChatRefreshes = 0;
const txHashChatApi = {
  ...api,
  getV2Wallet: async () => {
    txHashChatRefreshes += 1;
    return verifiedReadyWallet;
  },
  sendV2Chat: async () => ({
    mobileTurn: walletTurn,
    wallet: verifiedReadyWallet
  })
};

let walletGoalFallbackRefreshes = 0;
const walletGoalFallbackApi = {
  ...api,
  getV2Wallet: async () => {
    walletGoalFallbackRefreshes += 1;
    return refreshedWallet;
  },
  sendV2Chat: async () => ({ mobileTurn: walletTurn, orchestration: predictionOrchestration })
};

let predictionGoalRefreshes = 0;
const predictionGoalApi = {
  ...api,
  getV2Wallet: async () => {
    predictionGoalRefreshes += 1;
    return refreshedWallet;
  }
};

let inlinePredictionWalletRefreshes = 0;
const inlinePredictionWalletApi = {
  ...api,
  getV2Wallet: async () => {
    inlinePredictionWalletRefreshes += 1;
    return refreshedWallet;
  },
  sendV2Chat: async () => ({
    mobileTurn: predictionTurn,
    wallet: refreshedWallet
  })
};

const conflictApi = {
  ...api,
  getV2Wallet: async () => {
    throw Object.assign(new Error("wallet_address_conflict"), {
      code: "wallet_address_conflict",
      status: 409
    });
  }
};

const missingWalletApi = {
  ...api,
  verifyV2WalletTx: async () => {
    throw Object.assign(new Error("wallet_address_required"), {
      code: "wallet_address_required",
      status: 400
    });
  }
};

const verifiedReadyApi = {
  ...api,
  verifyV2WalletTx: async () => ({
    wallet: verifiedReadyWallet,
    mobileTurn: walletTurn
  }),
  sendV2Chat: async () => ({ mobileTurn: predictionTurn })
};

async function main() {
  const userAWallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
  const userBWallet = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`;
  const userAScope = createV2AgentWalletScopeKey("privy-user-a", userAWallet);
  const userAInitial = createScopedV2AgentWalletSession("privy-user-a", userAWallet);
  const userBInitial = createScopedV2AgentWalletSession("privy-user-b", userBWallet);

  if (userAInitial.scopeKey !== userAScope) {
    throw new Error("Expected scoped session to record the current Privy user and wallet.");
  }
  if (!isV2AgentWalletSessionScope(userAInitial, "privy-user-a", userAWallet)) {
    throw new Error("Expected session scope to match its owner user and wallet.");
  }
  if (isV2AgentWalletSessionScope(userAInitial, "privy-user-b", userBWallet)) {
    throw new Error("Expected session scope to reject a different logged-in user.");
  }
  if (userAInitial.messages.length !== 0 || userBInitial.messages.length !== 0) {
    throw new Error("Expected account switches to start from an empty mobile session.");
  }
  if (userAInitial.scopeKey === userBInitial.scopeKey) {
    throw new Error("Expected each Privy user and HWallet pair to have an isolated session scope.");
  }

  const selectedMarket = {
    provider: "okx-outcomes" as const,
    chainId: 196 as const,
    marketId: "selected-world-cup-market",
    question: "Will Spain win the 2026 FIFA World Cup?",
    acceptingOrders: true,
    yesPrice: 0.17
  };
  const afterChat = await sendV2AgentWalletText(
    api,
    initialV2AgentWalletSession,
    "帮我继续分析：西班牙会赢得 2026 年世界杯冠军吗？",
    "demo-user",
    undefined,
    selectedMarket
  );
  const latestCard = getLatestV2Card(afterChat);
  if (!latestCard) throw new Error("Expected latest card.");
  if (receivedCandidateMarketId !== selectedMarket.marketId) throw new Error("Expected selected market to be passed to chat API.");
  if (afterChat.orchestration?.capability.onchainSkill.mode !== "observe") {
    throw new Error("Expected chat response to store orchestration capability in mobile session.");
  }
  if (afterChat.orchestration?.capability.liveExecution.enabled !== false) {
    throw new Error("Expected mobile session orchestration to keep live execution disabled.");
  }

  const afterRefresh = await refreshV2AgentWallet(api, afterChat, "demo-user");
  if (afterRefresh.wallet?.address !== "0x1111111111111111111111111111111111111111") {
    throw new Error("Expected wallet refresh to update session wallet.");
  }
  if (afterRefresh.memory?.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected wallet refresh to update session memory.");
  }
  if (afterRefresh.audit[0]?.walletRecord?.id !== "wallet-record-refresh") {
    throw new Error("Expected wallet refresh audit to keep linked wallet record.");
  }
  if (afterRefresh.orchestration?.action !== afterChat.orchestration?.action) {
    throw new Error("Expected wallet refresh to preserve latest orchestration gate.");
  }
  const afterVerifyTx = await verifyV2AgentWalletTx(
    api,
    afterChat,
    "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
    "demo-user"
  );
  if (afterVerifyTx.memory?.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected tx verification to update session memory.");
  }
  if (afterVerifyTx.audit[0]?.walletRecord?.id !== "wallet-record-refresh") {
    throw new Error("Expected tx verification audit to keep linked wallet record.");
  }
  const afterSilentWalletLoad = await loadV2AgentWalletState(api, afterChat, "demo-user");
  if (afterSilentWalletLoad.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected silent wallet load to update session wallet.");
  }
  if (afterSilentWalletLoad.messages.length !== afterChat.messages.length) {
    throw new Error("Expected silent wallet load to avoid appending chat messages.");
  }
  const afterWalletConflict = await loadV2AgentWalletState(conflictApi, afterChat, "demo-user");
  if (!afterWalletConflict.error?.includes("这个账号已经绑定了 HWallet")) {
    throw new Error("Expected wallet conflict to use friendly mobile copy.");
  }
  const afterMissingWalletTx = await verifyV2AgentWalletTx(
    missingWalletApi,
    afterChat,
    "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
    "demo-user"
  );
  if (!afterMissingWalletTx.error?.includes("请先生成或绑定 HWallet")) {
    throw new Error("Expected missing wallet tx check to use friendly mobile copy.");
  }

  const afterReadyVerifyTx = await verifyV2AgentWalletTx(
    verifiedReadyApi,
    afterChat,
    "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
    "demo-user"
  );
  if (afterReadyVerifyTx.wallet?.agent?.fundsStatus !== "ready") {
    throw new Error("Expected verified tx to put mobile session wallet in ready state.");
  }
  const afterReadyFollowUp = await sendV2AgentWalletText(
    verifiedReadyApi,
    afterReadyVerifyTx,
    "好了，继续",
    "demo-user"
  );
  if (afterReadyFollowUp.wallet?.agent?.fundsStatus !== "ready") {
    throw new Error("Expected follow-up chat to preserve ready wallet state.");
  }
  if (getLatestV2Card(afterReadyFollowUp)?.type !== "prediction_card") {
    throw new Error("Expected ready wallet follow-up to append an Agent prediction card.");
  }
  if (afterReadyFollowUp.orchestration?.capability.onchainSkill.status !== "allowed") {
    throw new Error("Expected ready wallet follow-up to keep allowed Skill gate.");
  }

  const afterAction = await runV2AgentWalletCardAction(api, afterChat, {
    action: "simulate",
    card: latestCard,
    userId: "demo-user"
  });
  if (afterAction.home?.state.recordCount !== refreshedHome.state.recordCount) {
    throw new Error("Expected card action to refresh home record counts.");
  }
  if (afterAction.home?.recent.records[0]?.id !== "record-after-action") {
    throw new Error("Expected card action to refresh latest home records.");
  }
  if (afterAction.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected card action to keep wallet state synchronized from home refresh.");
  }
  if (afterAction.memory?.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected card action to refresh mobile memory.");
  }
  if (actionHomeRefreshes !== 1) {
    throw new Error("Expected card action to refresh home exactly once.");
  }

  const afterWalletChat = await sendV2AgentWalletText(
    walletGoalApi,
    afterChat,
    "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
    "demo-user"
  );
  if (afterWalletChat.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected wallet goal chat to refresh HWallet state.");
  }
  if (afterWalletChat.memory?.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected wallet goal chat to refresh mobile memory.");
  }
  if (walletGoalRefreshes !== 0) {
    throw new Error("Expected inline wallet goal chat to avoid an extra wallet refresh.");
  }

  const afterTxHashChat = await sendV2AgentWalletText(
    txHashChatApi,
    afterChat,
    "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
    "demo-user"
  );
  if (afterTxHashChat.wallet?.agent?.fundsStatus !== "ready") {
    throw new Error("Expected direct tx hash chat to put HWallet funds in ready state.");
  }
  if (afterTxHashChat.memory?.wallet?.address !== verifiedReadyWallet.address) {
    throw new Error("Expected direct tx hash chat to update mobile memory.");
  }
  if (txHashChatRefreshes !== 0) {
    throw new Error("Expected direct tx hash chat to avoid an extra wallet refresh.");
  }

  const afterWalletFallbackChat = await sendV2AgentWalletText(
    walletGoalFallbackApi,
    afterChat,
    "我已充值，帮我刷新",
    "demo-user"
  );
  if (afterWalletFallbackChat.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected fallback wallet goal chat to refresh HWallet state.");
  }
  if (walletGoalFallbackRefreshes !== 1) {
    throw new Error("Expected fallback wallet goal chat to refresh wallet exactly once.");
  }

  await sendV2AgentWalletText(
    predictionGoalApi,
    afterChat,
    "继续分析市场",
    "demo-user",
    undefined,
    selectedMarket
  );
  if (predictionGoalRefreshes !== 0) {
    throw new Error("Expected non-wallet chat to avoid wallet refresh.");
  }

  const afterInlinePredictionWallet = await sendV2AgentWalletText(
    inlinePredictionWalletApi,
    afterChat,
    "继续分析市场",
    "demo-user",
    undefined,
    selectedMarket
  );
  if (afterInlinePredictionWallet.wallet?.address !== refreshedWallet.address) {
    throw new Error("Expected inline wallet from prediction chat to update session wallet.");
  }
  if (inlinePredictionWalletRefreshes !== 0) {
    throw new Error("Expected inline wallet from prediction chat to avoid extra wallet refresh.");
  }

  console.log(JSON.stringify({
    chatMessages: afterChat.messages.length,
    refreshMessages: afterRefresh.messages.length,
    verifyTxMessages: afterVerifyTx.messages.length,
    readyFollowUpMessages: afterReadyFollowUp.messages.length,
    silentWalletMessages: afterSilentWalletLoad.messages.length,
    walletChatMessages: afterWalletChat.messages.length,
    walletFallbackChatMessages: afterWalletFallbackChat.messages.length,
    finalMessages: afterAction.messages.length,
    actionRecordCount: afterAction.home?.state.recordCount,
    auditWalletRecord: afterRefresh.audit[0]?.walletRecord?.id,
    latestCardType: latestCard.type,
    receivedCandidateMarketId,
    actionHomeRefreshes,
    walletGoalRefreshes,
    txHashChatRefreshes,
    walletGoalFallbackRefreshes,
    inlinePredictionWalletRefreshes,
    txHashChatFundsStatus: afterTxHashChat.wallet?.agent?.fundsStatus,
    readyFollowUpFundsStatus: afterReadyFollowUp.wallet?.agent?.fundsStatus,
    orchestrationAction: afterReadyFollowUp.orchestration?.action,
    orchestrationSkillMode: afterReadyFollowUp.orchestration?.capability.onchainSkill.mode,
    walletConflictCopy: afterWalletConflict.error,
    walletRequiredCopy: afterMissingWalletTx.error,
    error: afterAction.error
  }, null, 2));
}

main().catch((error) => {
  throw error;
});
