import { executeAgentCapability } from "../agent/mcp-capability-executor.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";

const baseWallet = {
  userId: "capability-executor-smoke-user",
  receiveAddress: "0x0000000000000000000000000000000000000001",
  chainId: 196,
  network: "X Layer",
  supportedAssets: ["USDT", "OKB"],
  assets: [],
  recentRecords: [],
  status: "ready",
  statusText: "HWallet 已经准备好。",
  agent: {
    mode: "observe_only",
    fundsStatus: "ready",
    availableText: "0.053127 USDT0 可用于 Agent 分析和模拟",
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

const unfundedWallet = {
  ...baseWallet,
  agent: {
    ...baseWallet.agent,
    fundsStatus: "empty",
    availableText: "还没有识别到可用资金。",
    nextActionText: "先充值到 HWallet。"
  },
  recentRecords: []
};

const okxMarket = {
  provider: "okx-outcomes",
  chainId: 196,
  marketId: "okx-worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  status: "active",
  acceptingOrders: true,
  yesPrice: 0.17,
  noPrice: 0.83,
  liquidity: 4210,
  volume24h: 988
};

const polymarketMarket = {
  provider: "polymarket-plugin",
  chainId: 137,
  marketId: "poly-worldcup-france",
  question: "France to win the 2026 World Cup?",
  acceptingOrders: true,
  yesPrice: 0.16,
  noPrice: 0.84
};

const receivePlan = await createAgentOrchestrationPlan({
  userText: "我要充值",
  wallet: baseWallet
});
const receiveResult = await executeAgentCapability({
  userText: "我要充值",
  walletAddress: baseWallet.receiveAddress,
  orchestration: receivePlan
});
assert(receiveResult.status === "skipped", "receive address should skip MCP executor");
assert(receiveResult.serviceId === "hwallet-core", "receive address stays internal");
assert(receiveResult.mcpCallStatus === "not_called", "receive address should not call MCP");
assert(receiveResult.moneyMoved === false, "receive address cannot move money");

const okxPlan = await createAgentOrchestrationPlan({
  userText: "帮我看看世界杯机会",
  wallet: baseWallet,
  candidateMarket: okxMarket
});
const okxResult = await executeAgentCapability({
  userText: "帮我看看世界杯机会",
  walletAddress: baseWallet.receiveAddress,
  orchestration: okxPlan
});
assert(okxResult.status === "observed", "OKX observe route should produce observed result");
assert(okxResult.serviceId === "okx-outcomes", "OKX observe should retain service id");
assert(okxResult.route === "outcomes.market.observe", "OKX observe should retain route");
assert(okxResult.safety === "read_only", "OKX observe stays read-only");
assert(okxResult.mcpCallStatus === "mocked", "OKX observe uses safe mock before real MCP");
assert(okxResult.liveExecutionEnabled === false, "OKX observe keeps live execution off");
assert(okxResult.moneyMoved === false, "OKX observe cannot move money");
assert(okxResult.summary.includes("会 17% / 不会 83%"), "OKX observe summary includes friendly market odds");
assert(okxResult.summary.includes("不提交订单"), "OKX observe summary keeps no-order boundary");
assert(okxResult.payload.market?.provider === "okx-outcomes", "OKX observe carries market snapshot");
assert(okxResult.payload.market?.yesPercent === 17, "OKX observe exposes YES percent");
assert(okxResult.payload.market?.noPercent === 83, "OKX observe exposes NO percent");
assert(okxResult.payload.market?.volume24h === 988, "OKX observe preserves 24h volume");
assert(okxResult.payload.market?.readOnly === true, "OKX observe payload is read-only");
assert(okxResult.payload.market?.moneyMovementEnabled === false, "OKX observe payload cannot move money");

const dryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下法国",
  wallet: baseWallet,
  candidateMarket: polymarketMarket
});
const dryRunResult = await executeAgentCapability({
  userText: "先模拟一下法国",
  walletAddress: baseWallet.receiveAddress,
  orchestration: dryRunPlan
});
assert(dryRunResult.status === "dry_run_completed", "plugin dry-run should complete a safe preview");
assert(dryRunResult.serviceId === "polymarket-plugin", "dry-run should retain plugin service");
assert(dryRunResult.route === "prediction.order.dry_run", "dry-run should retain command");
assert(dryRunResult.safety === "dry_run_only", "dry-run cannot become live execution");
assert(dryRunResult.moneyMoved === false, "dry-run cannot move money");

const blockedPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下法国",
  wallet: unfundedWallet,
  candidateMarket: polymarketMarket
});
const blockedResult = await executeAgentCapability({
  userText: "先模拟一下法国",
  walletAddress: unfundedWallet.receiveAddress,
  orchestration: blockedPlan
});
assert(blockedResult.status === "blocked", "unfunded dry-run should block executor");
assert(blockedResult.mcpCallStatus === "not_called", "blocked dry-run should not call MCP");
assert(blockedResult.moneyMoved === false, "blocked dry-run cannot move money");

const executeLikePlan = await createAgentOrchestrationPlan({
  userText: "买西班牙冠军 500U",
  wallet: baseWallet,
  candidateMarket: okxMarket
});
const executeLikeResult = await executeAgentCapability({
  userText: "买西班牙冠军 500U",
  walletAddress: baseWallet.receiveAddress,
  orchestration: executeLikePlan
});
assert(executeLikePlan.action === "analyze_worldcup_market", "execute-like text should downgrade to analysis");
assert(executeLikeResult.status === "observed", "execute-like text should only observe");
assert(executeLikeResult.safety === "read_only", "execute-like text stays read-only");
assert(executeLikeResult.liveExecutionEnabled === false, "execute-like text keeps live execution off");
assert(executeLikeResult.moneyMoved === false, "execute-like text cannot move money");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "wallet receive skips MCP calls",
    "OKX Outcomes route produces safe read-only observe result",
    "OKX observe result carries read-only market snapshot for Agent analysis",
    "Polymarket plugin route produces safe dry-run result",
    "unfunded dry-run blocks before any MCP call",
    "execute-like text is downgraded to observe",
    "all executor results keep moneyMoved false"
  ],
  results: {
    receive: pickResult(receiveResult),
    okxObserve: pickResult(okxResult),
    dryRun: pickResult(dryRunResult),
    blocked: pickResult(blockedResult),
    executeLike: pickResult(executeLikeResult)
  }
}, null, 2));

function pickResult(result) {
  return {
    serviceId: result.serviceId,
    route: result.route,
    mode: result.mode,
    status: result.status,
    mcpCallStatus: result.mcpCallStatus,
    moneyMoved: result.moneyMoved
  };
}

function assert(condition, label) {
  if (!condition) throw new Error(`Agent capability executor smoke failed: ${label}`);
}
