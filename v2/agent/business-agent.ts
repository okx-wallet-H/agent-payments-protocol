import type { BusinessGoal, BusinessGoalType, BusinessPlan, MarketSnapshot } from "../domain/types";

export function createBusinessGoal(userText: string, type?: BusinessGoalType): BusinessGoal {
  return {
    id: crypto.randomUUID(),
    userText,
    type: type || classifyGoal(userText),
    createdAt: new Date().toISOString()
  };
}

export function classifyGoal(userText: string): BusinessGoalType {
  const text = userText.toLowerCase();
  if (/0x[a-f0-9]{64}/.test(text)) return "wallet_tx_verify";
  if (/好了|充完|已充|已转|转了|到账|到了|到帐|done|finished|arrived/.test(text)) return "agent_fund_prepare";
  if (/充值|收款|地址|打钱|转入|转账|转钱|往.*转|deposit|receive|top.?up/.test(text)) return "wallet_receive";
  if (/余额|钱包|资产|balance|wallet/.test(text)) return "wallet_status";
  if (/执行|下单|买|卖|execute|buy|sell/.test(text)) return "prediction_market_execute";
  if (/模拟|dry.?run|试一下/.test(text)) return "prediction_market_dry_run";
  if (/世界杯|world cup|预测|机会|polymarket|prediction/.test(text)) return "prediction_market_research";
  return "unknown";
}

export function createPredictionResearchPlan(goal: BusinessGoal, market?: MarketSnapshot): BusinessPlan {
  const provider = market?.provider || "polymarket-plugin";
  return {
    id: crypto.randomUUID(),
    goalId: goal.id,
    mode: "observe",
    provider,
    market,
    summary: market
      ? `Observed market: ${market.question}.`
      : "Observe prediction markets through the configured provider capability.",
    createdAt: new Date().toISOString()
  };
}

export function createPredictionDryRunPlan(
  goal: BusinessGoal,
  input: {
    market: MarketSnapshot;
    side: "yes" | "no" | "up" | "down";
    amountUsd: number;
    limitPrice?: number;
  }
): BusinessPlan {
  return {
    id: crypto.randomUUID(),
    goalId: goal.id,
    mode: "dry_run",
    provider: input.market.provider,
    market: input.market,
    side: input.side,
    amountUsd: input.amountUsd,
    limitPrice: input.limitPrice,
    summary: `Dry-run ${input.side.toUpperCase()} on ${input.market.question} for $${input.amountUsd}.`,
    createdAt: new Date().toISOString()
  };
}
