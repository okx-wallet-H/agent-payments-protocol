import type { MarketSnapshot, TrackingCard } from "../domain/types";

export function createTrackingCard(market: MarketSnapshot): TrackingCard {
  return {
    type: "tracking_card",
    id: crypto.randomUUID(),
    title: "已加入跟踪",
    statusText: "跟踪中",
    agentNote: "我先帮你盯着这个方向。价格和热度有明显变化时，再提醒你看策略。",
    watchText: createWatchText(market),
    market,
    createdAt: new Date().toISOString()
  };
}

function createWatchText(market: MarketSnapshot): string {
  if (market.yesPrice !== undefined && market.yesPrice < 0.03) {
    return "重点看低赔率方向有没有突然放量。";
  }
  if (market.yesPrice !== undefined && market.yesPrice > 0.5) {
    return "重点看价格回落后有没有更舒服的位置。";
  }
  return "重点看成交热度和价格变化。";
}
