import type { BusinessPlan, ExecutionRequest } from "../domain/types";

export function buildPolymarketExecutionRequest(plan: BusinessPlan): ExecutionRequest {
  if (plan.provider !== "polymarket-plugin") {
    throw new Error(`Unsupported provider: ${plan.provider}`);
  }

  if (plan.mode === "observe") {
    return {
      id: crypto.randomUUID(),
      planId: plan.id,
      mode: "observe",
      provider: "polymarket-plugin",
      command: "polymarket-plugin list-markets",
      args: {
        keyword: "World Cup",
        limit: 8
      },
      createdAt: new Date().toISOString()
    };
  }

  if (!plan.market || !plan.side || !plan.amountUsd) {
    throw new Error("Dry-run or live execution requires market, side, and amount.");
  }

  return {
    id: crypto.randomUUID(),
    planId: plan.id,
    mode: plan.mode,
    provider: "polymarket-plugin",
    command: "polymarket-plugin buy",
    args: {
      marketId: plan.market.marketId,
      outcome: plan.side,
      amount: plan.amountUsd,
      price: plan.limitPrice,
      orderType: "GTC",
      dryRun: plan.mode === "dry_run"
    },
    createdAt: new Date().toISOString()
  };
}
