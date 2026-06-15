import { selectAgentCapabilityRoute } from "../agent/capability-registry.ts";
import { executeAgentCapability } from "../agent/mcp-capability-executor.ts";
import {
  AGENT_MCP_TOOL_CONTRACTS,
  getAgentMcpToolContract
} from "../agent/mcp-tool-contracts.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";

const wallet = {
  userId: "mcp-contract-smoke-user",
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

assert(AGENT_MCP_TOOL_CONTRACTS.length >= 10, "tool contract table covers internal, OKX, and plugin routes");
assert(
  AGENT_MCP_TOOL_CONTRACTS.every((contract) => contract.externalCallEnabled === false),
  "all contracts keep external calls disabled"
);
assert(
  AGENT_MCP_TOOL_CONTRACTS.every((contract) => contract.liveExecutionEnabled === false),
  "all contracts keep live execution disabled"
);
assert(
  AGENT_MCP_TOOL_CONTRACTS.every((contract) => contract.moneyMovementEnabled === false),
  "all contracts keep money movement disabled"
);
assert(
  AGENT_MCP_TOOL_CONTRACTS.every((contract) => !contract.input.required.includes("privateKey")),
  "contracts never require private keys"
);

const routeSamples = [
  selectAgentCapabilityRoute({ action: "show_receive_address", goalType: "wallet_receive" }),
  selectAgentCapabilityRoute({ action: "check_wallet_funds", goalType: "wallet_status" }),
  selectAgentCapabilityRoute({ action: "verify_wallet_transaction", goalType: "wallet_tx_verify" }),
  selectAgentCapabilityRoute({ action: "hold", goalType: "unknown" }),
  selectAgentCapabilityRoute({
    action: "analyze_worldcup_market",
    goalType: "prediction_market_research",
    market: okxMarket
  }),
  selectAgentCapabilityRoute({
    action: "simulate_prediction",
    goalType: "prediction_market_dry_run",
    market: okxMarket
  }),
  selectAgentCapabilityRoute({
    action: "analyze_worldcup_market",
    goalType: "prediction_market_research",
    market: polymarketMarket
  }),
  selectAgentCapabilityRoute({
    action: "simulate_prediction",
    goalType: "prediction_market_dry_run",
    market: polymarketMarket
  }),
  selectAgentCapabilityRoute({
    action: "analyze_worldcup_market",
    goalType: "prediction_market_research"
  }),
  selectAgentCapabilityRoute({
    action: "simulate_prediction",
    goalType: "prediction_market_dry_run"
  })
];

for (const route of routeSamples) {
  const contract = getAgentMcpToolContract({
    serviceId: route.serviceId,
    route: route.command,
    mode: route.mode
  });
  assert(Boolean(contract), `route has contract: ${route.serviceId}:${route.command}:${route.mode}`);
  assert(contract.safety === route.safety, `contract safety matches route: ${contract.id}`);
}

const okxPlan = await createAgentOrchestrationPlan({
  userText: "帮我看看世界杯机会",
  wallet,
  candidateMarket: okxMarket
});
const okxResult = await executeAgentCapability({
  userText: "帮我看看世界杯机会",
  walletAddress: wallet.receiveAddress,
  orchestration: okxPlan
});
assert(okxResult.contractId === "okx-outcomes:outcomes.market.observe:observe", "OKX executor result includes contract id");
assert(okxResult.toolName === "okx.outcomes.market.observe", "OKX executor result includes tool name");
assert(okxResult.externalCallEnabled === false, "OKX executor result keeps external call disabled");
assert(okxResult.payload.toolContract?.redactedInputs?.includes("authorization"), "OKX contract keeps auth redacted");
assert(okxResult.moneyMoved === false, "OKX contract result cannot move money");

const dryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下法国",
  wallet,
  candidateMarket: polymarketMarket
});
const dryRunResult = await executeAgentCapability({
  userText: "先模拟一下法国",
  walletAddress: wallet.receiveAddress,
  orchestration: dryRunPlan
});
assert(dryRunResult.contractId === "polymarket-plugin:prediction.order.dry_run:dry_run", "dry-run result includes plugin contract id");
assert(dryRunResult.toolName === "polymarket.order.dry_run", "dry-run result includes plugin tool name");
assert(dryRunResult.safety === "dry_run_only", "dry-run result stays dry-run only");
assert(dryRunResult.payload.toolContract?.moneyMovementEnabled === false, "dry-run contract keeps money movement disabled");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "tool contract table covers every current capability route",
    "all contracts disable external calls, live execution, and money movement",
    "contracts do not require private keys",
    "route safety matches contract safety",
    "executor results expose contract id and tool name",
    "auth/access token inputs are redacted in contract metadata"
  ],
  contracts: AGENT_MCP_TOOL_CONTRACTS.map((contract) => ({
    id: contract.id,
    toolName: contract.toolName,
    stage: contract.stage,
    safety: contract.safety
  })),
  okxResult: {
    contractId: okxResult.contractId,
    toolName: okxResult.toolName,
    status: okxResult.status,
    moneyMoved: okxResult.moneyMoved
  },
  dryRunResult: {
    contractId: dryRunResult.contractId,
    toolName: dryRunResult.toolName,
    status: dryRunResult.status,
    moneyMoved: dryRunResult.moneyMoved
  }
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent MCP tool contracts smoke failed: ${label}`);
}
