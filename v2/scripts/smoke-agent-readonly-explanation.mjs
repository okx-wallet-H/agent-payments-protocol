import { handlePhaseOneUserText } from "../agent/conversation-turn.ts";
import { executeAgentCapability } from "../agent/mcp-capability-executor.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";

const wallet = {
  userId: "readonly-explanation-smoke-user",
  receiveAddress: "0x0000000000000000000000000000000000000001",
  chainId: 196,
  network: "X Layer",
  supportedAssets: ["USDT", "OKB"],
  assets: [],
  recentRecords: [
    {
      id: "wallet-deposit-detected-smoke",
      type: "deposit",
      status: "confirmed",
      title: "USDT0 到账",
      description: "测试资金已同步",
      txHash: "0xreadonlyexplanationsmoke",
      amountText: "0.75 USDT0",
      createdAt: new Date("2026-06-18T09:00:00.000Z").toISOString()
    }
  ],
  status: "ready",
  statusText: "HWallet 已经准备好。",
  agent: {
    mode: "observe_only",
    fundsStatus: "ready",
    availableText: "0.75 USDT0 可用于 Agent 分析和模拟",
    primaryAsset: "USDT0",
    nextActionText: "可以让 Agent 看机会，先模拟不下单。"
  },
  vault: {
    id: "agent-vault-xlayer-primary",
    title: "Agent 资金池",
    status: "ready",
    displayText: "已识别资金",
    policyText: "先分析和模拟。",
    sourceText: "来自 HWallet 收款地址",
    userVisibleAddress: false
  },
  policy: {
    id: "agent-wallet-mvp-observe-only",
    mode: "mvp_observe_only",
    allowedActions: ["analyze", "track", "build_strategy", "simulate"],
    liveExecutionEnabled: false,
    maxSimulationUsd: 20,
    allowedProviders: ["polymarket-plugin", "okx-outcomes"],
    allowedChains: [137, 196],
    policyText: "第一版只分析和模拟，不提交真实订单。"
  },
  skillBoundary: {
    identity: "privy",
    capabilities: "okx-onchainos-skills",
    liveExecution: "disabled_for_mvp"
  }
};

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  marketId: "okx-worldcup-spain-readonly",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  status: "active",
  acceptingOrders: true,
  yesPrice: 0.17,
  noPrice: 0.83,
  liquidity: 4210,
  volume24h: 988
};

const userText = "我已经转好了，买西班牙冠军 500U";
const walletFundText = "已识别 0.75 USDT0，可用于 Agent 分析和模拟。";

const plan = await createAgentOrchestrationPlan({
  userText,
  wallet,
  candidateMarket: market,
  walletFundText
});

assert(plan.action === "analyze_worldcup_market", "execute-like request downgrades to read-only analysis");
assert(plan.goalType === "prediction_market_research", "execute-like request keeps research goal");
assert(plan.capability.liveExecution.enabled === false, "orchestration keeps live execution disabled");

const turn = handlePhaseOneUserText({
  userText,
  xLayerAddress: wallet.receiveAddress,
  polygonAddress: "0x0000000000000000000000000000000000000002",
  candidateMarket: market,
  walletFundText,
  goalType: plan.goalType
});

assert(turn.finalText.includes(walletFundText), "final text carries wallet funds context");
assert(turn.finalText.includes("当前快照：会 17% / 不会 83%。"), "final text carries friendly read-only odds");
assert(turn.finalText.includes("不会真实下单"), "final text keeps no-live-order boundary");
assert(turn.cards.length === 1, "turn includes one prediction card");

const predictionCard = turn.cards[0];
assert(predictionCard.type === "prediction_card", "turn card is a prediction card");
assert(predictionCard.metrics.probabilityLabel === "会 17%", "prediction card carries YES odds");
assert(predictionCard.metrics.priceLabel === "会 17¢ / 不会 83¢", "prediction card carries YES/NO prices");
assert(predictionCard.actions.includes("simulate"), "prediction card offers simulation instead of live execution");
assert(predictionCard.actions.includes("track"), "prediction card offers tracking");

const result = await executeAgentCapability({
  userText,
  walletAddress: wallet.receiveAddress,
  orchestration: plan
});

assert(result.status === "observed", "capability executor only observes");
assert(result.safety === "read_only", "capability executor stays read-only");
assert(result.summary.includes("会 17% / 不会 83%"), "executor summary carries friendly read-only odds");
assert(result.summary.includes("不提交订单"), "executor summary keeps no-order boundary");
assert(result.moneyMoved === false, "executor never moves money");
assert(result.liveExecutionEnabled === false, "executor keeps live execution disabled");
assert(result.payload.market?.readOnly === true, "executor market payload is read-only");
assert(result.payload.market?.moneyMovementEnabled === false, "executor market payload cannot move money");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "execute-like request downgrades to read-only analysis",
    "Agent final reply carries wallet context and YES/NO odds",
    "prediction card exposes read-only YES/NO prices",
    "capability executor observes only",
    "live execution and money movement remain disabled"
  ],
  finalText: turn.finalText,
  card: {
    type: predictionCard.type,
    probabilityLabel: predictionCard.metrics.probabilityLabel,
    priceLabel: predictionCard.metrics.priceLabel,
    actions: predictionCard.actions
  },
  executor: {
    status: result.status,
    safety: result.safety,
    moneyMoved: result.moneyMoved,
    liveExecutionEnabled: result.liveExecutionEnabled
  }
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent read-only explanation smoke failed: ${label}`);
}
