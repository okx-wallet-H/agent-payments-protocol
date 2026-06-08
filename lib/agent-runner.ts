import { createExecutionPreview } from "./execution-preview";
import { listPredictionMarketsViaRouter } from "./onchainos-router";
import { createPredictionIntent } from "./prediction";
import { evaluateIntent } from "./risk";
import type { Agent, AgentRun, ExecutionPreview, PredictionMarket, TradeIntent } from "./types";

export interface AgentRunResult {
  run: AgentRun;
  intent?: TradeIntent;
  preview?: ExecutionPreview;
}

export async function runPredictionAgent(agent: Agent, amountOkb: number, keyword = "World Cup"): Promise<AgentRunResult> {
  const observed = await listPredictionMarketsViaRouter(keyword, 10);
  const selectedMarket = selectPredictionMarket(observed.markets);

  if (!selectedMarket) {
    const run = createRun(agent, {
      status: "failed",
      router: observed.router,
      observedMarketCount: observed.markets.length,
      selectionReason: "暂时没有找到可继续分析的公开市场。",
      riskNotes: ["No market candidate"]
    });
    return { run };
  }

  const intent = createPredictionIntent(agent, {
    market: "polymarket-world-cup-2026",
    provider: "onchainos_plugin",
    side: "yes",
    amountOkb,
    externalMarketId: selectedMarket.id,
    externalMarketSlug: selectedMarket.slug,
    externalQuestion: selectedMarket.question,
    marketProbability: selectedMarket.yesPrice,
    yesPrice: selectedMarket.yesPrice,
    thesis: `AI 从公开市场中选出了一个相对活跃的世界杯相关市场：${selectedMarket.question}`
  });
  const riskNotes = evaluateIntent(agent, intent);
  const nextIntent: TradeIntent = {
    ...intent,
    riskNotes,
    status: riskNotes.length > 0 ? "blocked" : "approved"
  };
  const preview = createExecutionPreview(agent, nextIntent, riskNotes);
  const run = createRun(agent, {
    status: riskNotes.length > 0 ? "blocked" : "completed",
    router: observed.router,
    observedMarketCount: observed.markets.length,
    selectedMarketId: selectedMarket.id,
    selectedQuestion: selectedMarket.question,
    selectionReason: explainMarketSelection(selectedMarket),
    intentId: nextIntent.id,
    previewId: preview.id,
    riskNotes
  });

  return { run, intent: nextIntent, preview };
}

function selectPredictionMarket(markets: PredictionMarket[]): PredictionMarket | undefined {
  return markets
    .filter((market) => market.acceptingOrders)
    .sort((a, b) => marketScore(b) - marketScore(a))[0];
}

function marketScore(market: PredictionMarket): number {
  const liquidity = Number.isFinite(market.liquidity) ? market.liquidity || 0 : 0;
  const volume = Number.isFinite(market.volume24hr) ? market.volume24hr || 0 : 0;
  const priceBalance = 1 - Math.abs((market.yesPrice || 0.5) - 0.5);
  return Math.log10(1 + liquidity) + Math.log10(1 + volume) + priceBalance;
}

function explainMarketSelection(market: PredictionMarket): string {
  return `选择了一个目前可交易的市场：YES 价格约 ${Math.round(market.yesPrice * 100)}%，流动性约 ${Math.round(
    market.liquidity || 0
  )}，24 小时成交量约 ${Math.round(market.volume24hr || 0)}。`;
}

function createRun(
  agent: Agent,
  input: Omit<AgentRun, "id" | "agentId" | "goal" | "createdAt">
): AgentRun {
  return {
    id: crypto.randomUUID(),
    agentId: agent.id,
    goal: "查看世界杯相关市场，生成安全规则检查后的方案，并先给出执行预览。",
    createdAt: new Date().toISOString(),
    ...input
  };
}
