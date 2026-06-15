import { executeAgentCapability } from "../agent/mcp-capability-executor.ts";
import {
  buildAgentMcpToolAdapterInvocation,
  runAgentMcpToolAdapterSafely
} from "../agent/mcp-tool-adapter.ts";
import { getAgentMcpToolContract } from "../agent/mcp-tool-contracts.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";

const wallet = {
  userId: "mcp-adapter-smoke-user",
  receiveAddress: "0x0000000000000000000000000000000000000001",
  chainId: 196,
  network: "X Layer",
  supportedAssets: ["USDT", "OKB"],
  assets: [],
  recentRecords: [
    {
      id: "wallet-deposit-detected-smoke",
      title: "资金已到账",
      note: "新到账 0.005 USDT0，Agent 可以继续分析或模拟。",
      status: "synced",
      createdAt: new Date().toISOString()
    }
  ],
  status: "ready",
  statusText: "HWallet 已经准备好。",
  agent: {
    mode: "observe_only",
    fundsStatus: "ready",
    availableText: "0.005 USDT0 可用于 Agent 分析和模拟",
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
  ...wallet,
  recentRecords: [],
  agent: {
    ...wallet.agent,
    fundsStatus: "empty",
    availableText: "还没有识别到可用资金。",
    nextActionText: "先充值到 HWallet。"
  }
};

const okxMarket = {
  provider: "okx-outcomes",
  chainId: 196,
  marketId: "okx-worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  acceptingOrders: true,
  yesPrice: 0.17,
  noPrice: 0.83
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
  wallet
});
const receiveResult = await executeAgentCapability({
  userText: "我要充值",
  walletAddress: wallet.receiveAddress,
  orchestration: receivePlan
});
assert(receiveResult.adapterStatus === "not_required", "receive address should not need MCP adapter");
assert(receiveResult.externalCallAttempted === false, "receive address should not attempt external calls");
assert(receiveResult.payload.adapter.status === "not_required", "receive payload records adapter status");

let adapterInvoked = false;
const spyAdapter = {
  async invoke() {
    adapterInvoked = true;
    throw new Error("adapter should not be invoked while contracts are disabled");
  }
};

const okxPlan = await createAgentOrchestrationPlan({
  userText: "帮我看看世界杯机会",
  wallet,
  candidateMarket: okxMarket
});
const okxResult = await executeAgentCapability({
  userText: "帮我看看世界杯机会",
  walletAddress: wallet.receiveAddress,
  orchestration: okxPlan,
  adapter: spyAdapter
});
assert(okxResult.adapterStatus === "disabled", "OKX observe adapter stays disabled until explicitly enabled");
assert(okxResult.externalCallAttempted === false, "OKX observe should not attempt external calls");
assert(okxResult.payload.adapter.payload.toolName === "okx.outcomes.market.observe", "OKX adapter payload keeps tool name");
assert(adapterInvoked === false, "disabled contract should not invoke the supplied adapter");

const dryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下法国",
  wallet,
  candidateMarket: polymarketMarket
});
const dryRunResult = await executeAgentCapability({
  userText: "先模拟一下法国",
  walletAddress: wallet.receiveAddress,
  orchestration: dryRunPlan,
  adapter: spyAdapter
});
assert(dryRunResult.adapterStatus === "disabled", "plugin dry-run adapter stays disabled");
assert(dryRunResult.safety === "dry_run_only", "plugin dry-run remains dry-run only");
assert(dryRunResult.externalCallAttempted === false, "plugin dry-run should not attempt external calls");
assert(adapterInvoked === false, "dry-run disabled contract should not invoke adapter");

const blockedPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下法国",
  wallet: unfundedWallet,
  candidateMarket: polymarketMarket
});
const blockedResult = await executeAgentCapability({
  userText: "先模拟一下法国",
  walletAddress: unfundedWallet.receiveAddress,
  orchestration: blockedPlan,
  adapter: spyAdapter
});
assert(blockedResult.adapterStatus === "blocked", "blocked plan should block adapter lane");
assert(blockedResult.mcpCallStatus === "not_called", "blocked plan should not call MCP");
assert(blockedResult.moneyMoved === false, "blocked plan cannot move money");
assert(adapterInvoked === false, "blocked plan should not invoke adapter");

const contract = getAgentMcpToolContract({
  serviceId: "okx-outcomes",
  route: "outcomes.market.observe",
  mode: "observe"
});
const invocation = buildAgentMcpToolAdapterInvocation({
  request: {
    requestId: "adapter-smoke-request",
    userText: "看看西班牙",
    action: "analyze_worldcup_market",
    goalType: "prediction_market_research",
    serviceId: "okx-outcomes",
    serviceKind: "api",
    serviceLabel: "OKX Outcomes API",
    route: "outcomes.market.observe",
    mode: "observe",
    safety: "read_only",
    capabilityStatus: "allowed",
    capabilityReason: "读取市场，只生成分析。",
    walletAddress: wallet.receiveAddress,
    market: {
      provider: okxMarket.provider,
      chainId: okxMarket.chainId,
      marketId: okxMarket.marketId,
      question: okxMarket.question
    },
    liveExecutionEnabled: false,
    createdAt: new Date().toISOString()
  },
  contract
});
assert(invocation.toolName === "okx.outcomes.market.observe", "adapter invocation maps tool name");
assert(invocation.redactedInputs.includes("authorization"), "adapter invocation keeps redacted auth fields");
assert(invocation.externalCallEnabled === false, "adapter invocation respects disabled contract");
assert(invocation.moneyMovementEnabled === false, "adapter invocation cannot move money");

const missingContractResult = await runAgentMcpToolAdapterSafely({
  request: {
    ...invocation,
    serviceKind: "api",
    serviceLabel: "Unknown",
    capabilityStatus: "allowed",
    capabilityReason: "missing contract",
    liveExecutionEnabled: false,
    createdAt: new Date().toISOString()
  }
});
assert(missingContractResult.status === "not_required", "missing contract falls back without external calls");
assert(missingContractResult.externalCallAttempted === false, "missing contract does not attempt external calls");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "internal HWallet actions do not need adapter",
    "read-only and dry-run contracts keep adapter disabled",
    "disabled contracts do not invoke supplied adapter",
    "blocked plans stop before adapter invocation",
    "adapter invocation maps toolName and redacted fields",
    "missing contracts fall back without external calls"
  ],
  results: {
    receive: pickResult(receiveResult),
    okxObserve: pickResult(okxResult),
    dryRun: pickResult(dryRunResult),
    blocked: pickResult(blockedResult),
    missingContract: {
      status: missingContractResult.status,
      externalCallAttempted: missingContractResult.externalCallAttempted
    }
  }
}, null, 2));

function pickResult(result) {
  return {
    contractId: result.contractId,
    toolName: result.toolName,
    status: result.status,
    adapterStatus: result.adapterStatus,
    externalCallAttempted: result.externalCallAttempted,
    moneyMoved: result.moneyMoved
  };
}

function assert(condition, label) {
  if (!condition) throw new Error(`Agent MCP tool adapter smoke failed: ${label}`);
}
