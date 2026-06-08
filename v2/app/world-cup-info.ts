import type { MarketSnapshot, WorldCupInfoPanel } from "../domain/types";

export function createWorldCupInfoPanel(markets: MarketSnapshot[]): WorldCupInfoPanel {
  const activeMarkets = markets.filter((market) => market.acceptingOrders);
  const hottest = activeMarkets
    .slice()
    .sort((a, b) => Math.max(b.volume24h || 0, b.liquidity || 0) - Math.max(a.volume24h || 0, a.liquidity || 0))
    .slice(0, 3);

  return {
    type: "world_cup_info_panel",
    title: "世界杯",
    summary: activeMarkets.length > 0 ? `我整理了 ${activeMarkets.length} 个可关注方向。` : "暂时没有可关注的世界杯方向。",
    items: hottest.map((market) => ({
      id: market.marketId,
      title: market.question,
      subtitle: market.acceptingOrders ? "可关注" : "观察中",
      value: market.yesPrice === undefined ? undefined : `YES ${market.yesPrice.toFixed(3)}`
    })),
    updatedAt: new Date().toISOString()
  };
}
