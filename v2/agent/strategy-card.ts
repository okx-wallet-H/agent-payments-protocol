import type { MarketSnapshot, StrategyCard } from "../domain/types";
import { friendlyWorldCupDisplay } from "../app/world-cup-explore";

export function createStrategyCard(market: MarketSnapshot): StrategyCard {
  const isLongShot = market.yesPrice !== undefined && market.yesPrice < 0.03;
  const title = isWorldCupMarket(market) ? `策略：${friendlyWorldCupDisplay(market.question).title}` : "策略草案";

  return {
    type: "strategy_card",
    id: crypto.randomUUID(),
    title,
    statusText: isLongShot ? "冷门观察" : "可以模拟",
    agentNote: isLongShot
      ? "这个方向赔率很高，但不能冲动。我会把它当成冷门机会，先做小额模拟和跟踪。"
      : "这个方向可以继续拆成策略。我先用模拟结果看它值不值得跟。",
    steps: isLongShot
      ? ["先用小金额模拟", "观察成交热度变化", "只在价格和热度同时合适时继续"]
      : ["先整理市场数据", "跑一次模拟", "根据模拟结果决定是否跟踪"],
    riskText: isLongShot ? "冷门方向波动大，不能重仓。" : "先模拟，不急着执行。",
    nextAction: "simulate",
    market,
    createdAt: new Date().toISOString()
  };
}

function isWorldCupMarket(market: MarketSnapshot): boolean {
  return market.provider === "okx-outcomes" || /world cup|世界杯|fifa/i.test(market.question);
}
