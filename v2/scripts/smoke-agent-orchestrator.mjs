import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";

const baseWallet = {
  userId: "smoke-user",
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
    fundsStatus: "waiting",
    availableText: "暂未看到可用资金",
    nextActionText: "充值稳定币到 HWallet 后，Agent 会识别到账状态。"
  },
  vault: {
    id: "agent-vault-xlayer-primary",
    title: "Agent 资金池",
    status: "waiting",
    displayText: "等待充值到账",
    policyText: "到账后先做世界杯分析和模拟。",
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
  marketId: "worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  acceptingOrders: true,
  yesPrice: 0.17,
  noPrice: 0.83
};

const fundedPlan = await createAgentOrchestrationPlan({
  userText: "好了，我充完了",
  wallet: {
    ...baseWallet,
    recentRecords: [
      {
        id: "wallet-deposit-detected",
        title: "资金已到账",
        note: "新到账 5 USDT，Agent 可以继续分析或模拟。",
        status: "synced",
        createdAt: new Date().toISOString()
      }
    ]
  },
  getCandidateMarket: async () => market
});

assert(fundedPlan.action === "analyze_worldcup_market", "funded wallet should continue into market analysis");
assert(fundedPlan.goalType === "prediction_market_research", "funded wallet should override goal to research");
assert(fundedPlan.candidateMarket?.marketId === market.marketId, "funded wallet should attach market");
assert(fundedPlan.capability.walletReady === true, "funded route requires a ready HWallet");
assert(fundedPlan.capability.fundsReady === false, "deposit record alone does not fake synced balance");
assert(fundedPlan.capability.onchainSkill.status === "allowed", "funded route can use read-only Onchain Skill");
assert(fundedPlan.capability.onchainSkill.mode === "observe", "funded route stays in observe mode");
assert(fundedPlan.capability.liveExecution.enabled === false, "funded route keeps live execution disabled");

const versionedDepositPlan = await createAgentOrchestrationPlan({
  userText: "好了，我充完了",
  wallet: {
    ...baseWallet,
    recentRecords: [
      {
        id: "wallet-deposit-detected-usdt0-0_005-okb-0",
        title: "资金已到账",
        note: "新到账 0.005 USDT0，Agent 可以继续分析或模拟。",
        status: "synced",
        createdAt: new Date().toISOString()
      }
    ]
  },
  getCandidateMarket: async () => market
});

assert(versionedDepositPlan.action === "analyze_worldcup_market", "versioned deposit record should continue into market analysis");
assert(versionedDepositPlan.goalType === "prediction_market_research", "versioned deposit record should override goal to research");

const readyBalancePlan = await createAgentOrchestrationPlan({
  userText: "好了，继续",
  wallet: {
    ...baseWallet,
    agent: {
      ...baseWallet.agent,
      fundsStatus: "ready",
      availableText: "0.053127 USDT0 可用于 Agent 分析和模拟",
      primaryAsset: "USDT0",
      nextActionText: "可以让 Agent 看世界杯机会，先模拟不下单。"
    },
    recentRecords: [
      {
        id: "wallet-assets-sync",
        title: "暂无新到账",
        note: "已刷新 X Layer 资产，余额暂时没有变化。",
        status: "synced",
        createdAt: new Date().toISOString()
      }
    ]
  },
  getCandidateMarket: async () => market
});

assert(readyBalancePlan.action === "analyze_worldcup_market", "ready wallet balance should continue into market analysis");
assert(readyBalancePlan.goalType === "prediction_market_research", "ready wallet balance should override goal to research");
assert(readyBalancePlan.capability.fundsReady === true, "ready balance route exposes funds readiness");

const unfundedPlan = await createAgentOrchestrationPlan({
  userText: "好了，我充完了",
  wallet: {
    ...baseWallet,
    recentRecords: [
      {
        id: "wallet-no-new-funds",
        title: "暂无新到账",
        note: "HWallet 暂时没有新的资金变化。",
        status: "synced",
        createdAt: new Date().toISOString()
      }
    ]
  }
});

assert(unfundedPlan.action === "check_wallet_funds", "unfunded wallet should stay in fund check");
assert(unfundedPlan.goalType === "agent_fund_prepare", "unfunded wallet should keep fund prepare goal");
assert(unfundedPlan.capability.onchainSkill.status === "not_needed", "unfunded wallet check does not call Onchain Skill");

const predictionPlan = await createAgentOrchestrationPlan({
  userText: "帮我看看世界杯机会",
  wallet: baseWallet,
  getCandidateMarket: async () => market
});

assert(predictionPlan.action === "analyze_worldcup_market", "worldcup text should analyze market");
assert(predictionPlan.candidateMarket?.marketId === market.marketId, "worldcup text should attach market");
assert(predictionPlan.capability.onchainSkill.status === "allowed", "prediction analysis can use Onchain Skill");
assert(predictionPlan.capability.policyDecision?.status === "allow", "prediction analysis passes policy");

const dryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下",
  wallet: {
    ...baseWallet,
    agent: {
      ...baseWallet.agent,
      fundsStatus: "ready",
      availableText: "0.053127 USDT0 可用于 Agent 分析和模拟",
      primaryAsset: "USDT0",
      nextActionText: "可以让 Agent 看市场机会，先模拟不下单。"
    }
  },
  getCandidateMarket: async () => market
});

assert(dryRunPlan.action === "simulate_prediction", "dry-run text should select simulation action");
assert(dryRunPlan.capability.needsFunds === true, "simulation declares funds requirement");
assert(dryRunPlan.capability.fundsReady === true, "simulation sees ready funds");
assert(dryRunPlan.capability.onchainSkill.status === "allowed", "simulation can use dry-run Skill path");
assert(dryRunPlan.capability.onchainSkill.mode === "dry_run", "simulation stays in dry-run mode");
assert(dryRunPlan.capability.liveExecution.enabled === false, "simulation keeps live execution disabled");

const unfundedDryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下",
  wallet: baseWallet,
  getCandidateMarket: async () => market
});

assert(unfundedDryRunPlan.action === "simulate_prediction", "unfunded dry-run still routes to simulation intent");
assert(unfundedDryRunPlan.capability.onchainSkill.status === "blocked", "unfunded dry-run blocks Skill usage");
assert(/等待 HWallet/.test(unfundedDryRunPlan.capability.onchainSkill.reason), "unfunded dry-run gives wallet-friendly block reason");

const executePlan = await createAgentOrchestrationPlan({
  userText: "买西班牙冠军",
  wallet: {
    ...baseWallet,
    agent: {
      ...baseWallet.agent,
      fundsStatus: "ready",
      availableText: "0.053127 USDT0 可用于 Agent 分析和模拟",
      primaryAsset: "USDT0",
      nextActionText: "可以让 Agent 看市场机会，先模拟不下单。"
    }
  },
  getCandidateMarket: async () => market
});

assert(executePlan.action === "analyze_worldcup_market", "execute-like text is downgraded to analysis");
assert(executePlan.goalType === "prediction_market_research", "execute-like text keeps research goal");
assert(executePlan.capability.liveExecution.enabled === false, "execute-like text keeps live execution closed");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "funded route",
    "versioned deposit route",
    "ready balance route",
    "unfunded route",
    "prediction route",
    "dry-run gate",
    "unfunded dry-run block",
    "execute downgraded"
  ],
  fundedAction: fundedPlan.action,
  versionedDepositAction: versionedDepositPlan.action,
  readyBalanceAction: readyBalancePlan.action,
  unfundedAction: unfundedPlan.action,
  predictionAction: predictionPlan.action,
  dryRunSkillMode: dryRunPlan.capability.onchainSkill.mode,
  liveExecutionEnabled: executePlan.capability.liveExecution.enabled
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent orchestrator smoke failed: ${label}`);
}
