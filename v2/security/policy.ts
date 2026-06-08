import type { AgentContext, AgentPolicy, BusinessPlan, PolicyDecision } from "../domain/types";

export function evaluatePlanPolicy(agent: AgentContext, policy: AgentPolicy, plan: BusinessPlan): PolicyDecision {
  const reasons: string[] = [];

  if (agent.status !== "active") reasons.push(`Agent is ${agent.status}.`);
  if (!policy.allowedProviders.includes(plan.provider)) reasons.push(`Provider ${plan.provider} is not allowed.`);
  if (plan.market && !policy.allowedChains.includes(plan.market.chainId)) {
    reasons.push(`Chain ${plan.market.chainId} is not allowed.`);
  }
  if (plan.market && policy.allowedMarkets.length > 0 && !policy.allowedMarkets.includes(plan.market.marketId)) {
    reasons.push("Market is not allowlisted.");
  }
  if (plan.amountUsd && plan.amountUsd > policy.maxSingleTradeUsd) {
    reasons.push(`Amount $${plan.amountUsd} exceeds single-trade limit $${policy.maxSingleTradeUsd}.`);
  }
  if (plan.mode === "live" && !policy.liveExecutionEnabled) {
    reasons.push("Live execution is disabled.");
  }

  if (reasons.length > 0) {
    return { status: "block", reasons };
  }

  if (plan.mode === "live") {
    return {
      status: "needs_user_confirmation",
      reasons: ["Live execution requires explicit user confirmation."],
      requiredConfirmationText: "confirm live execution"
    };
  }

  return { status: "allow", reasons: ["Plan is allowed for observe or dry-run mode."] };
}
