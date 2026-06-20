import { selectAgentCapabilityRoute, type AgentCapabilityRoute } from "./capability-registry";
import { classifyGoal } from "./business-agent";
import { evaluateAgentPolicy, type AgentPolicyAction, type AgentPolicyDecision } from "./policy";
import type { BusinessGoalType, MarketSnapshot } from "../domain/types";
import type { AgentWalletContext } from "../wallet/wallet-orchestrator";

export type AgentOrchestratorAction =
  | "show_receive_address"
  | "check_wallet_funds"
  | "verify_wallet_transaction"
  | "analyze_worldcup_market"
  | "simulate_prediction"
  | "hold";

export interface AgentOrchestrationPlan {
  action: AgentOrchestratorAction;
  goalType: BusinessGoalType;
  candidateMarket?: MarketSnapshot;
  walletStatusText?: string;
  walletFundText?: string;
  progressHint: string;
  capability: AgentCapabilityGate;
}

export interface AgentCapabilityGate {
  walletReady: boolean;
  fundsReady: boolean;
  needsWallet: boolean;
  needsFunds: boolean;
  onchainSkill: {
    status: "allowed" | "blocked" | "not_needed";
    mode: "none" | "observe" | "dry_run";
    capability: "none" | "okx-onchainos-skills";
    reason: string;
    serviceId?: AgentCapabilityRoute["serviceId"];
    serviceKind?: AgentCapabilityRoute["serviceKind"];
    serviceLabel?: string;
    route?: string;
    safety?: AgentCapabilityRoute["safety"];
  };
  liveExecution: {
    enabled: false;
    reason: string;
  };
  policyDecision?: AgentPolicyDecision;
}

export async function createAgentOrchestrationPlan(input: {
  userText: string;
  wallet: AgentWalletContext;
  candidateMarket?: MarketSnapshot;
  getCandidateMarket?: () => Promise<MarketSnapshot | undefined>;
  walletStatusText?: string;
  walletFundText?: string;
}): Promise<AgentOrchestrationPlan> {
  const classifiedGoal = classifyGoal(input.userText);
  const deposit = input.wallet.recentRecords.find(isWalletDepositRecord);
  const fundsReady = input.wallet.agent.fundsStatus === "ready";

  if (classifiedGoal === "wallet_receive") {
    return withCapability({
      action: "show_receive_address",
      goalType: "wallet_receive",
      walletStatusText: input.walletStatusText,
      walletFundText: input.walletFundText,
      progressHint: "给用户展示主收款地址"
    }, input.wallet);
  }

  if (classifiedGoal === "wallet_status") {
    return withCapability({
      action: "check_wallet_funds",
      goalType: "wallet_status",
      walletStatusText: input.walletStatusText,
      walletFundText: input.walletFundText,
      progressHint: "查看 HWallet 资产状态"
    }, input.wallet);
  }

  if (classifiedGoal === "wallet_tx_verify") {
    return withCapability({
      action: "verify_wallet_transaction",
      goalType: "wallet_tx_verify",
      walletStatusText: input.walletStatusText,
      walletFundText: input.walletFundText,
      progressHint: "核验用户提供的交易记录"
    }, input.wallet);
  }

  if (classifiedGoal === "agent_fund_prepare") {
    if (deposit || fundsReady) {
      const candidateMarket = input.candidateMarket || (await input.getCandidateMarket?.());
      return withCapability({
        action: "analyze_worldcup_market",
        goalType: "prediction_market_research",
        candidateMarket,
        walletStatusText: input.walletStatusText,
        walletFundText: input.walletFundText,
        progressHint: "资金到账后进入真实预测市场分析"
      }, input.wallet);
    }

    return withCapability({
      action: "check_wallet_funds",
      goalType: "agent_fund_prepare",
      walletStatusText: input.walletStatusText,
      walletFundText: input.walletFundText,
      progressHint: "刷新 HWallet 到账状态"
    }, input.wallet);
  }

  if (classifiedGoal === "prediction_market_dry_run") {
    const candidateMarket = input.candidateMarket || (await input.getCandidateMarket?.());
    return withCapability({
      action: "simulate_prediction",
      goalType: "prediction_market_dry_run",
      candidateMarket,
      walletStatusText: input.walletStatusText,
      walletFundText: input.walletFundText,
      progressHint: "准备预测模拟，不做真实下单"
    }, input.wallet);
  }

  if (classifiedGoal === "prediction_market_research" || classifiedGoal === "prediction_market_execute") {
    const candidateMarket = input.candidateMarket || (await input.getCandidateMarket?.());
    return withCapability({
      action: "analyze_worldcup_market",
      goalType: "prediction_market_research",
      candidateMarket,
      walletStatusText: input.walletStatusText,
      walletFundText: input.walletFundText,
      progressHint: "读取真实预测市场并生成观察卡"
    }, input.wallet);
  }

  return withCapability({
    action: "hold",
    goalType: "unknown",
    walletStatusText: input.walletStatusText,
    walletFundText: input.walletFundText,
    progressHint: "等待用户给出更明确的目标"
  }, input.wallet);
}

function isWalletDepositRecord(record: AgentWalletContext["recentRecords"][number]): boolean {
  return record.id === "wallet-deposit-detected" || record.id.startsWith("wallet-deposit-detected-");
}

function withCapability(
  plan: Omit<AgentOrchestrationPlan, "capability">,
  wallet: AgentWalletContext
): AgentOrchestrationPlan {
  return {
    ...plan,
    capability: createCapabilityGate(plan, wallet)
  };
}

function createCapabilityGate(
  plan: Omit<AgentOrchestrationPlan, "capability">,
  wallet: AgentWalletContext
): AgentCapabilityGate {
  const walletReady = wallet.status === "ready";
  const fundsReady = wallet.agent.fundsStatus === "ready";
  const needsWallet = shouldRequireWallet(plan.action);
  const needsFunds = shouldRequireFunds(plan.action);
  const policyAction = toPolicyAction(plan.action);
  const route = selectAgentCapabilityRoute({
    action: plan.action,
    goalType: plan.goalType,
    market: plan.candidateMarket
  });
  const policyDecision = policyAction
    ? evaluateAgentPolicy({
        action: policyAction,
        market: plan.candidateMarket,
        wallet,
        policy: wallet.policy
      })
    : undefined;

  const blockedReason = getCapabilityBlockReason({
    walletReady,
    fundsReady,
    needsWallet,
    needsFunds,
    policyDecision
  });

  return {
    walletReady,
    fundsReady,
    needsWallet,
    needsFunds,
    onchainSkill: {
      status: policyAction ? blockedReason ? "blocked" : "allowed" : "not_needed",
      mode: route.mode,
      capability: policyAction ? wallet.skillBoundary.capabilities : "none",
      reason: policyAction
        ? blockedReason || route.reason
        : route.reason,
      serviceId: route.serviceId,
      serviceKind: route.serviceKind,
      serviceLabel: route.label,
      route: route.command,
      safety: route.safety
    },
    liveExecution: {
      enabled: false,
      reason: "MVP 阶段关闭真实下单，Agent 只做分析、跟踪和模拟。"
    },
    policyDecision
  };
}

function shouldRequireWallet(action: AgentOrchestratorAction): boolean {
  return action !== "hold";
}

function shouldRequireFunds(action: AgentOrchestratorAction): boolean {
  return action === "simulate_prediction";
}

function toPolicyAction(action: AgentOrchestratorAction): AgentPolicyAction | undefined {
  if (action === "analyze_worldcup_market") return "analyze";
  if (action === "simulate_prediction") return "simulate";
  return undefined;
}

function getCapabilityBlockReason(input: {
  walletReady: boolean;
  fundsReady: boolean;
  needsWallet: boolean;
  needsFunds: boolean;
  policyDecision?: AgentPolicyDecision;
}): string | undefined {
  if (input.needsWallet && !input.walletReady) {
    return "等待用户 HWallet 生成或绑定后再继续。";
  }
  if (input.needsFunds && !input.fundsReady) {
    return "等待 HWallet 识别可用资金后再做模拟。";
  }
  if (input.policyDecision?.status === "block") {
    return input.policyDecision.userText;
  }
  return undefined;
}
