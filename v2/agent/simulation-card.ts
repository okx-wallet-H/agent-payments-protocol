import type { ExecutionResult, MarketSnapshot, SimulationCard } from "../domain/types";

interface PolymarketDryRunRaw {
  data?: {
    note?: string;
    usdc_amount?: number;
    usdc_requested?: number;
    shares?: number;
    limit_price?: number;
    outcome?: string;
    market?: string;
  };
  dry_run?: boolean;
  ok?: boolean;
}

export function createSimulationCard(result: ExecutionResult, market: MarketSnapshot): SimulationCard {
  const raw = result.raw as PolymarketDryRunRaw | undefined;
  const data = raw?.data;
  const amount = data?.usdc_amount ?? data?.usdc_requested;
  const outcome = data?.outcome || "YES";

  return {
    type: "simulation_card",
    id: crypto.randomUUID(),
    title: `模拟：${data?.market || market.question}`,
    statusText: result.status === "dry_run_completed" ? "模拟完成" : "模拟失败",
    agentNote:
      result.status === "dry_run_completed"
        ? "我先帮你跑了一遍模拟，订单没有提交。这个结果可以用来判断要不要继续跟踪。"
        : result.summary,
    marketTitle: data?.market || market.question,
    sideLabel: formatOutcome(outcome),
    amountLabel: amount === undefined ? "金额待确认" : `$${amount.toFixed(3)}`,
    sharesLabel: data?.shares === undefined ? undefined : `约 ${data.shares} 份`,
    priceLabel: data?.limit_price === undefined ? undefined : `价格 ${data.limit_price}`,
    moneyMoved: false,
    market,
    createdAt: new Date().toISOString()
  };
}

function formatOutcome(outcome: string): string {
  if (/^yes$/i.test(outcome)) return "方向：会";
  if (/^no$/i.test(outcome)) return "方向：不会";
  return `方向：${outcome}`;
}
