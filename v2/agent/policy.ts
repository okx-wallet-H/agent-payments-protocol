import type { MarketSnapshot } from "../domain/types";
import type { AgentWalletContext } from "../wallet/wallet-orchestrator";

export type AgentPolicyAction = "analyze" | "track" | "build_strategy" | "simulate" | "execute";

export interface AgentPolicyState {
  id: string;
  mode: "mvp_observe_only";
  allowedActions: AgentPolicyAction[];
  liveExecutionEnabled: false;
  maxSimulationUsd: number;
  allowedProviders: Array<MarketSnapshot["provider"]>;
  allowedChains: Array<MarketSnapshot["chainId"]>;
  policyText: string;
}

export interface AgentPolicyDecision {
  status: "allow" | "block";
  action: AgentPolicyAction;
  reason: string;
  userText: string;
  policy: AgentPolicyState;
}

export function createDefaultAgentPolicy(): AgentPolicyState {
  return {
    id: "agent-policy-mvp-observe-only",
    mode: "mvp_observe_only",
    allowedActions: ["analyze", "track", "build_strategy", "simulate"],
    liveExecutionEnabled: false,
    maxSimulationUsd: 100,
    allowedProviders: ["okx-outcomes", "polymarket-plugin"],
    allowedChains: [196, 137],
    policyText: "第一版只允许分析、跟踪和模拟，不开放真实下单。"
  };
}

export function evaluateAgentPolicy(input: {
  action: AgentPolicyAction;
  market?: MarketSnapshot;
  amountUsd?: number;
  wallet?: AgentWalletContext;
  policy?: AgentPolicyState;
}): AgentPolicyDecision {
  const policy = input.policy || createDefaultAgentPolicy();

  if (!policy.allowedActions.includes(input.action)) {
    return block(input.action, policy, "当前版本没有开放这个动作。", "这个动作暂时还不能做。");
  }

  if (input.action === "execute" || !policy.liveExecutionEnabled && /execute/.test(input.action)) {
    return block(input.action, policy, "实盘执行开关关闭。", "当前只支持分析、跟踪和模拟。");
  }

  if (input.action === "simulate" && (input.amountUsd || 1) > policy.maxSimulationUsd) {
    return block(input.action, policy, "模拟金额超过上限。", `单次模拟最多 ${policy.maxSimulationUsd} USDT。`);
  }

  if (input.market && !policy.allowedProviders.includes(input.market.provider)) {
    return block(input.action, policy, "市场来源不在允许列表。", "这个市场暂时不能交给 Agent 处理。");
  }

  if (input.market && !policy.allowedChains.includes(input.market.chainId)) {
    return block(input.action, policy, "链不在允许列表。", "这个网络暂时不支持。");
  }

  return {
    status: "allow",
    action: input.action,
    reason: "Policy allow",
    userText: policy.policyText,
    policy
  };
}

function block(
  action: AgentPolicyAction,
  policy: AgentPolicyState,
  reason: string,
  userText: string
): AgentPolicyDecision {
  return {
    status: "block",
    action,
    reason,
    userText,
    policy
  };
}
