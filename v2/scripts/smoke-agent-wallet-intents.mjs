import { handlePhaseOneUserText } from "../agent/conversation-turn.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";
import { createAgentWalletContext, withSyncedAgentWalletState } from "../wallet/wallet-orchestrator.ts";

const xLayerAddress = "0x1111111111111111111111111111111111111111";
const polygonAddress = "0x2222222222222222222222222222222222222222";

const wallet = createAgentWalletContext({
  userId: "agent-wallet-intent-smoke-user",
  walletAddress: xLayerAddress
});

const fundedWallet = withSyncedAgentWalletState(wallet, {
  assets: [
    {
      symbol: "USDT0",
      name: "USD Tether 0",
      amountLabel: "0.005",
      amountValue: "0.005",
      valueLabel: "0.005 USDT",
      syncStatus: "synced"
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      amountLabel: "0",
      amountValue: "0",
      valueLabel: "0 USDT",
      syncStatus: "synced"
    },
    {
      symbol: "OKB",
      name: "X Layer Gas",
      amountLabel: "0",
      amountValue: "0",
      valueLabel: "0 OKB",
      syncStatus: "synced"
    }
  ],
  recentRecords: [
    {
      id: "wallet-deposit-detected-usdt0-0_005-okb-0",
      title: "资金已到账",
      note: "新到账 0.005 USDT0，Agent 可以继续分析或模拟。",
      status: "synced",
      createdAt: new Date().toISOString()
    }
  ]
});

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  marketId: "worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  acceptingOrders: true,
  yesPrice: 0.17,
  noPrice: 0.83
};

for (const userText of ["我要充值", "给我地址", "我想往 HWallet 转 500U"]) {
  const plan = await createAgentOrchestrationPlan({ userText, wallet });

  assert(plan.action === "show_receive_address", `${userText} should show receive address`);
  assert(plan.goalType === "wallet_receive", `${userText} should stay in wallet_receive`);
  assert(plan.capability.walletReady === true, `${userText} should use ready wallet`);
  assert(plan.capability.onchainSkill.status === "not_needed", `${userText} should not call Skill`);
  assert(plan.capability.liveExecution.enabled === false, `${userText} should keep live execution closed`);
}

const receiveTurn = handlePhaseOneUserText({
  userText: "我要充值",
  xLayerAddress,
  polygonAddress,
  walletStatusText: wallet.statusText,
  walletFundText: wallet.agent.availableText
});
const receiveCard = receiveTurn.cards[0];

assert(receiveTurn.goal.type === "wallet_receive", "receive conversation should keep wallet_receive goal");
assert(receiveTurn.finalText?.includes("复制"), "receive conversation should use friendly copy text");
assert(receiveCard?.type === "receive_card", "receive conversation should render a receive card");
assert(receiveCard.primaryAction === "copy", "receive card should expose copy action");
assert(receiveCard.addresses.length === 1, "receive card should expose only the main address");
assert(receiveCard.addresses[0].address === xLayerAddress, "receive card should expose X Layer address");
assert(receiveCard.addresses[0].chainId === 196, "receive card should stay on X Layer");
assert(!receiveCard.addresses.some((item) => item.address === polygonAddress), "receive card should hide strategy address");

const txPlan = await createAgentOrchestrationPlan({
  userText: "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
  wallet
});

assert(txPlan.action === "verify_wallet_transaction", "tx hash should route to transaction verification");
assert(txPlan.goalType === "wallet_tx_verify", "tx hash should keep wallet_tx_verify goal");
assert(txPlan.capability.onchainSkill.status === "not_needed", "tx hash verification should stay in wallet status lane");
assert(txPlan.capability.liveExecution.enabled === false, "tx hash verification should keep live execution closed");

const transferDonePlan = await createAgentOrchestrationPlan({
  userText: "我转了 0.005",
  wallet
});

assert(transferDonePlan.action === "check_wallet_funds", "transfer-done text should refresh wallet funds");
assert(transferDonePlan.goalType === "agent_fund_prepare", "transfer-done text should keep fund prepare goal");
assert(transferDonePlan.capability.onchainSkill.status === "not_needed", "transfer-done check should not call Skill");
assert(transferDonePlan.capability.liveExecution.enabled === false, "transfer-done check should keep live execution closed");

const fundedPlan = await createAgentOrchestrationPlan({
  userText: "我已经转好了，继续看看机会",
  wallet: fundedWallet,
  getCandidateMarket: async () => market
});

assert(fundedPlan.action === "analyze_worldcup_market", "funded follow-up should enter analysis");
assert(fundedPlan.goalType === "prediction_market_research", "funded follow-up should become research");
assert(fundedPlan.capability.fundsReady === true, "funded follow-up should see ready funds");
assert(fundedPlan.capability.onchainSkill.status === "allowed", "funded follow-up may use read-only Skill");
assert(fundedPlan.capability.onchainSkill.mode === "observe", "funded follow-up should stay in observe mode");
assert(fundedPlan.capability.liveExecution.enabled === false, "funded follow-up should keep live execution closed");

const executeLikePlan = await createAgentOrchestrationPlan({
  userText: "买西班牙冠军 500U",
  wallet: fundedWallet,
  getCandidateMarket: async () => market
});

assert(executeLikePlan.action === "analyze_worldcup_market", "execute-like text should downgrade to analysis");
assert(executeLikePlan.goalType === "prediction_market_research", "execute-like text should stay research");
assert(executeLikePlan.capability.policyDecision?.action === "analyze", "execute-like text should not become policy execute");
assert(executeLikePlan.capability.liveExecution.enabled === false, "execute-like text should keep live execution closed");

const dryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下西班牙",
  wallet: fundedWallet,
  getCandidateMarket: async () => market
});

assert(dryRunPlan.action === "simulate_prediction", "dry-run text should select simulation");
assert(dryRunPlan.capability.onchainSkill.status === "allowed", "funded dry-run should be allowed");
assert(dryRunPlan.capability.onchainSkill.mode === "dry_run", "dry-run should use dry_run Skill mode");
assert(dryRunPlan.capability.liveExecution.enabled === false, "dry-run should keep live execution closed");

const unfundedDryRunPlan = await createAgentOrchestrationPlan({
  userText: "先模拟一下西班牙",
  wallet,
  getCandidateMarket: async () => market
});

assert(unfundedDryRunPlan.action === "simulate_prediction", "unfunded dry-run should keep simulation intent");
assert(unfundedDryRunPlan.capability.onchainSkill.status === "blocked", "unfunded dry-run should block Skill usage");
assert(/等待 HWallet/.test(unfundedDryRunPlan.capability.onchainSkill.reason), "unfunded dry-run should explain the wallet wait");
assert(unfundedDryRunPlan.capability.liveExecution.enabled === false, "unfunded dry-run should keep live execution closed");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "receive prompts route to main HWallet address",
    "receive card exposes only one user-facing address",
    "transaction hash routes to wallet verification",
    "transfer-done text refreshes wallet funds",
    "funded follow-up enters read-only analysis",
    "execute-like text downgrades to analysis",
    "dry-run stays simulated",
    "unfunded dry-run blocks Skill usage"
  ],
  receiveAddressCount: receiveCard.addresses.length,
  fundedAction: fundedPlan.action,
  executeLikeAction: executeLikePlan.action,
  liveExecutionEnabled: executeLikePlan.capability.liveExecution.enabled
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent wallet intent smoke failed: ${label}`);
}
