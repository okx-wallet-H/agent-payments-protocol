import type { MarketSnapshot, PredictionCard } from "../domain/types";
import { createWorldCupAgentNote, friendlyWorldCupDisplay, inferWorldCupCategory } from "../app/world-cup-explore";

export function createPredictionCard(market: MarketSnapshot): PredictionCard {
  const yesPercent = market.yesPrice === undefined ? undefined : Math.round(market.yesPrice * 100);
  const heatLabel = formatHeat(market.volume24h, market.liquidity);
  const isWorldCup = isWorldCupMarket(market);
  const display = isWorldCup ? friendlyWorldCupDisplay(market.question) : undefined;
  const noPercent = market.noPrice === undefined ? undefined : Math.round(market.noPrice * 100);

  return {
    type: "prediction_card",
    id: crypto.randomUUID(),
    title: display?.title || market.question,
    statusText: market.acceptingOrders ? "可以继续看" : "先观察",
    agentNote: isWorldCup ? createWorldCupAgentNote(inferWorldCupCategory(market), market) : createAgentNote(market, heatLabel),
    market,
    metrics: {
      probabilityLabel: yesPercent === undefined ? undefined : `会 ${yesPercent}%`,
      heatLabel,
      priceLabel: formatPriceMetric(market, yesPercent, noPercent)
    },
    suggestedAction: isWorldCup ? "我先把它放进观察，继续看热度和价格变化。" : "我建议先模拟一遍，看看这个策略跑出来是什么效果。",
    actions: ["simulate", "track", "build_strategy"],
    createdAt: new Date().toISOString()
  };
}

function isWorldCupMarket(market: MarketSnapshot): boolean {
  return market.provider === "okx-outcomes" || /world cup|世界杯|fifa/i.test(market.question);
}

function formatPriceMetric(market: MarketSnapshot, yesPercent?: number, noPercent?: number): string | undefined {
  if (yesPercent === undefined && noPercent === undefined) return undefined;
  const yes = yesPercent === undefined ? "观察" : `${yesPercent}¢`;
  const no = noPercent === undefined ? "观察" : `${noPercent}¢`;
  return `会 ${yes} / 不会 ${no}`;
}

function createAgentNote(market: MarketSnapshot, heatLabel?: string): string {
  if (!market.acceptingOrders) {
    return "这个市场现在不适合直接做，我先放到观察里。";
  }

  if (market.yesPrice !== undefined && market.yesPrice < 0.03) {
    return `我看了一下，这个方向赔率很高，但胜率也低。${heatLabel ? `热度是${heatLabel}，` : ""}适合先模拟，不适合直接重仓。`;
  }

  if (market.yesPrice !== undefined && market.yesPrice > 0.5) {
    return `这个方向市场已经比较认可，价格不便宜。${heatLabel ? `热度是${heatLabel}，` : ""}我会先看有没有更好的入场点。`;
  }

  return `${heatLabel ? `这个市场热度是${heatLabel}。` : "这个市场可以继续观察。"}我先把它整理成策略，再给你看模拟结果。`;
}

function formatHeat(volume24h?: number, liquidity?: number): string | undefined {
  const score = Math.max(volume24h || 0, liquidity || 0);
  if (!score) return undefined;
  if (score >= 1_000_000) return "很活跃";
  if (score >= 100_000) return "还不错";
  return "一般";
}
