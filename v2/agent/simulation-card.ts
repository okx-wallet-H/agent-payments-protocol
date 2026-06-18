import type { ExecutionResult, MarketSnapshot, SimulationCard } from "../domain/types";

interface PolymarketDryRunRaw {
  provider?: string;
  route?: string;
  data?: {
    note?: string;
    usdc_amount?: number;
    usdc_requested?: number;
    usdt_amount?: number;
    amount_usd?: number;
    shares?: number;
    estimated_shares?: number;
    limit_price?: number;
    yes_price?: number;
    no_price?: number;
    outcome?: string;
    market?: string;
    provider_label?: string;
  };
  dry_run?: boolean;
  ok?: boolean;
  moneyMoved?: boolean;
  liveExecutionEnabled?: boolean;
  externalCall?: boolean;
}

export function createSimulationCard(result: ExecutionResult, market: MarketSnapshot): SimulationCard {
  const raw = result.raw as PolymarketDryRunRaw | undefined;
  const data = raw?.data;
  const isOkxPreview = raw?.provider === "okx-outcomes" || raw?.route === "outcomes.order.preview";
  const amount = data?.usdt_amount ?? data?.amount_usd ?? data?.usdc_amount ?? data?.usdc_requested;
  const outcome = data?.outcome || "YES";
  const shares = data?.estimated_shares ?? data?.shares;
  const price = data?.limit_price ?? (/^no$/i.test(outcome) ? data?.no_price : data?.yes_price);

  return {
    type: "simulation_card",
    id: crypto.randomUUID(),
    title: `模拟：${data?.market || market.question}`,
    statusText: result.status === "dry_run_completed" ? "模拟完成" : "模拟失败",
    agentNote:
      result.status === "dry_run_completed"
        ? isOkxPreview
          ? "这是 OKX Outcomes 本地模拟预览，订单没有提交，也没有签名或广播。这个结果可以用来判断要不要继续跟踪。"
          : "我先帮你跑了一遍模拟，订单没有提交。这个结果可以用来判断要不要继续跟踪。"
        : result.summary,
    marketTitle: data?.market || market.question,
    sideLabel: formatOutcome(outcome),
    amountLabel: amount === undefined ? "金额待确认" : `${amount.toFixed(3)} ${isOkxPreview ? "USDT" : "USDC"}`,
    sharesLabel: shares === undefined ? undefined : `约 ${shares} 份`,
    priceLabel: price === undefined ? undefined : `${isOkxPreview ? "预览价" : "价格"} ${price}`,
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
