import {
  AGENT_CAPABILITY_SERVICES,
  selectAgentCapabilityRoute
} from "../agent/capability-registry.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";

const baseWallet = {
  userId: "capability-smoke-user",
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

assert(AGENT_CAPABILITY_SERVICES.some((service) => service.id === "hwallet-core"), "registry includes HWallet core");
assert(
  AGENT_CAPABILITY_SERVICES.some((service) => service.id === "okx-onchainos-skills" && service.kind === "mcp_skill"),
  "registry includes OKX Onchain OS Skill service"
);
assert(AGENT_CAPABILITY_SERVICES.some((service) => service.id === "okx-outcomes"), "registry includes OKX Outcomes");
assert(AGENT_CAPABILITY_SERVICES.some((service) => service.id === "polymarket-plugin"), "registry includes plugin route");
assert(
  AGENT_CAPABILITY_SERVICES.every((service) => service.liveExecutionEnabled === false),
  "all registry services keep live execution disabled"
);

const receiveRoute = selectAgentCapabilityRoute({
  action: "show_receive_address",
  goalType: "wallet_receive"
});
assert(receiveRoute.serviceId === "hwallet-core", "receive address stays internal");
assert(receiveRoute.mode === "none", "receive address has no external mode");
assert(receiveRoute.safety === "no_external_call", "receive address does not call MCP");

const okxObserveRoute = selectAgentCapabilityRoute({
  action: "analyze_worldcup_market",
  goalType: "prediction_market_research",
  market: okxMarket
});
assert(okxObserveRoute.serviceId === "okx-outcomes", "OKX market routes to OKX Outcomes");
assert(okxObserveRoute.mode === "observe", "OKX market stays observe");
assert(okxObserveRoute.safety === "read_only", "OKX market route is read-only");

const polymarketDryRunRoute = selectAgentCapabilityRoute({
  action: "simulate_prediction",
  goalType: "prediction_market_dry_run",
  market: polymarketMarket
});
assert(polymarketDryRunRoute.serviceId === "polymarket-plugin", "Polymarket market routes to plugin");
assert(polymarketDryRunRoute.mode === "dry_run", "plugin simulation stays dry-run");
assert(polymarketDryRunRoute.safety === "dry_run_only", "plugin simulation is dry-run only");

const okxPlan = await createAgentOrchestrationPlan({
  userText: "帮我看看世界杯机会",
  wallet: baseWallet,
  candidateMarket: okxMarket
});
assert(okxPlan.capability.onchainSkill.status === "allowed", "OKX analysis can use capability route");
assert(okxPlan.capability.onchainSkill.serviceId === "okx-outcomes", "OKX analysis exposes service id");
assert(okxPlan.capability.onchainSkill.serviceKind === "api", "OKX analysis exposes service kind");
assert(okxPlan.capability.onchainSkill.route === "outcomes.market.observe", "OKX analysis exposes route");
assert(okxPlan.capability.onchainSkill.safety === "read_only", "OKX analysis is read-only");
assert(okxPlan.capability.liveExecution.enabled === false, "OKX analysis keeps live execution closed");

const dryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下",
  wallet: baseWallet,
  candidateMarket: polymarketMarket
});
assert(dryRunPlan.capability.onchainSkill.status === "allowed", "plugin dry-run is allowed after funds");
assert(dryRunPlan.capability.onchainSkill.serviceId === "polymarket-plugin", "dry-run exposes plugin service");
assert(dryRunPlan.capability.onchainSkill.route === "prediction.order.dry_run", "dry-run exposes route");
assert(dryRunPlan.capability.onchainSkill.safety === "dry_run_only", "dry-run cannot become live execution");
assert(dryRunPlan.capability.liveExecution.enabled === false, "dry-run keeps live execution closed");

const walletPlan = await createAgentOrchestrationPlan({
  userText: "我要充值",
  wallet: baseWallet
});
assert(walletPlan.capability.onchainSkill.status === "not_needed", "wallet receive does not need external capability");
assert(walletPlan.capability.onchainSkill.serviceId === "hwallet-core", "wallet receive exposes internal service");
assert(walletPlan.capability.onchainSkill.safety === "no_external_call", "wallet receive stays no external call");

const executeLikePlan = await createAgentOrchestrationPlan({
  userText: "买西班牙冠军 500U",
  wallet: baseWallet,
  candidateMarket: okxMarket
});
assert(executeLikePlan.action === "analyze_worldcup_market", "execute-like text is downgraded to analysis");
assert(executeLikePlan.capability.onchainSkill.serviceId === "okx-outcomes", "downgraded execute still routes to read-only service");
assert(executeLikePlan.capability.onchainSkill.safety === "read_only", "downgraded execute stays read-only");
assert(executeLikePlan.capability.liveExecution.enabled === false, "downgraded execute keeps live execution closed");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "registry lists internal, MCP Skill, API, and plugin services",
    "all services keep live execution disabled",
    "wallet receive stays internal",
    "OKX Outcomes markets route to read-only observe",
    "Polymarket plugin route stays dry-run only",
    "orchestrator exposes service id/kind/route/safety",
    "execute-like text is still downgraded to read-only analysis"
  ],
  services: AGENT_CAPABILITY_SERVICES.map((service) => ({
    id: service.id,
    kind: service.kind,
    modes: service.supportedModes
  })),
  okxRoute: okxPlan.capability.onchainSkill.route,
  dryRunRoute: dryRunPlan.capability.onchainSkill.route,
  liveExecutionEnabled: executeLikePlan.capability.liveExecution.enabled
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent capability registry smoke failed: ${label}`);
}
