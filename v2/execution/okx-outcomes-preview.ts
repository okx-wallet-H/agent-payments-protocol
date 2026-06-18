import type { BusinessPlan, ExecutionResult } from "../domain/types";

export function createOkxOutcomesDryRunPlan(input: {
  basePlan: BusinessPlan;
  amountUsd: number;
  side?: "yes" | "no";
  limitPrice?: number;
}): BusinessPlan {
  if (!input.basePlan.market) throw new Error("OKX Outcomes preview requires a market.");

  const side = input.side || "yes";
  const price = input.limitPrice ?? (side === "yes" ? input.basePlan.market.yesPrice : input.basePlan.market.noPrice);

  return {
    ...input.basePlan,
    id: crypto.randomUUID(),
    mode: "dry_run",
    provider: "okx-outcomes",
    side,
    amountUsd: input.amountUsd,
    limitPrice: price,
    summary: `OKX Outcomes local preview ${side.toUpperCase()} on ${input.basePlan.market.question} for ${input.amountUsd} USDT.`,
    createdAt: new Date().toISOString()
  };
}

export function executeOkxOutcomesDryRunPreview(plan: BusinessPlan): ExecutionResult {
  if (plan.provider !== "okx-outcomes") {
    throw new Error(`Unsupported OKX Outcomes preview provider: ${plan.provider}`);
  }
  if (plan.mode !== "dry_run") {
    throw new Error(`Unsupported OKX Outcomes preview mode: ${plan.mode}`);
  }
  if (!plan.market) throw new Error("OKX Outcomes preview requires a market.");

  const side = plan.side === "no" ? "no" : "yes";
  const amount = plan.amountUsd || 1;
  const price = plan.limitPrice ?? (side === "yes" ? plan.market.yesPrice : plan.market.noPrice) ?? 0.5;
  const shares = price > 0 ? Number((amount / price).toFixed(4)) : undefined;

  return {
    requestId: `okx-preview-${crypto.randomUUID()}`,
    status: "dry_run_completed",
    summary: "OKX Outcomes local preview completed without creating, signing, submitting, or broadcasting an order.",
    raw: {
      dry_run: true,
      ok: true,
      local_preview: true,
      provider: "okx-outcomes",
      route: "outcomes.order.preview",
      safety: "dry_run_only",
      liveExecutionEnabled: false,
      moneyMoved: false,
      externalCall: false,
      data: {
        note: "OKX Outcomes 本地模拟预览，未创建订单、未签名、未提交、未广播。",
        market: plan.market.question,
        market_id: plan.market.marketId,
        outcome: side,
        amount_usd: amount,
        usdt_amount: amount,
        estimated_shares: shares,
        limit_price: price,
        yes_price: plan.market.yesPrice,
        no_price: plan.market.noPrice,
        provider_label: "OKX Outcomes"
      }
    },
    createdAt: new Date().toISOString()
  };
}
