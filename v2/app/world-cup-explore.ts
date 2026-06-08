import type { MarketSnapshot } from "../domain/types";

export type WorldCupExploreCategory = "champion" | "golden_boot" | "group_stage" | "upcoming_matches";

export interface WorldCupExploreOption {
  id: string;
  label: string;
  price?: number;
  priceLabel?: string;
  assetId?: string;
  side?: "yes" | "no";
}

export interface WorldCupExploreMarketCard {
  id: string;
  category: WorldCupExploreCategory;
  title: string;
  subtitle?: string;
  probabilityLabel?: string;
  volumeLabel?: string;
  status: "tradeable" | "watch_only";
  market: MarketSnapshot;
  options: WorldCupExploreOption[];
}

export interface WorldCupExploreView {
  type: "world_cup_explore_view";
  categories: Array<{
    id: WorldCupExploreCategory;
    label: string;
  }>;
  cards: Record<WorldCupExploreCategory, WorldCupExploreMarketCard[]>;
  updatedAt: string;
}

const categories: WorldCupExploreView["categories"] = [
  { id: "champion", label: "冠军" },
  { id: "golden_boot", label: "金靴奖得主" },
  { id: "group_stage", label: "小组赛" },
  { id: "upcoming_matches", label: "近期比赛" }
];

export function createWorldCupExploreView(markets: MarketSnapshot[]): WorldCupExploreView {
  const cards = markets.map(toExploreCard);

  return {
    type: "world_cup_explore_view",
    categories,
    cards: {
      champion: cards.filter((card) => card.category === "champion"),
      golden_boot: cards.filter((card) => card.category === "golden_boot"),
      group_stage: cards.filter((card) => card.category === "group_stage"),
      upcoming_matches: cards.filter((card) => card.category === "upcoming_matches")
    },
    updatedAt: new Date().toISOString()
  };
}

export function inferWorldCupCategory(market: MarketSnapshot): WorldCupExploreCategory {
  const text = `${market.question} ${market.raw ? JSON.stringify(market.raw).slice(0, 500) : ""}`.toLowerCase();
  if (/(golden boot|金靴|top scorer|最佳射手)/i.test(text)) return "golden_boot";
  if (/(group|组第一|小组|小组赛)/i.test(text)) return "group_stage";
  if (/( vs | v |\\bdraw\\b|平局|近期|match|比赛)/i.test(text)) return "upcoming_matches";
  return "champion";
}

function toExploreCard(market: MarketSnapshot): WorldCupExploreMarketCard {
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;

  return {
    id: market.marketId,
    category: inferWorldCupCategory(market),
    title: market.question,
    subtitle: market.endDate ? `结束时间 ${market.endDate}` : undefined,
    probabilityLabel: yesPrice === undefined ? undefined : `${Math.round(yesPrice * 100)}%`,
    volumeLabel: formatVolume(market.volume24h || market.volume),
    status: market.acceptingOrders ? "tradeable" : "watch_only",
    market,
    options: [
      {
        id: `${market.marketId}:yes`,
        label: "Yes",
        price: yesPrice,
        priceLabel: formatPrice(yesPrice),
        assetId: market.yesAssetId,
        side: "yes" as const
      },
      {
        id: `${market.marketId}:no`,
        label: "No",
        price: noPrice,
        priceLabel: formatPrice(noPrice),
        assetId: market.noAssetId,
        side: "no" as const
      }
    ].filter((option) => option.price !== undefined || option.assetId)
  };
}

function formatPrice(price?: number): string | undefined {
  if (price === undefined) return undefined;
  return `${Math.round(price * 100)}¢`;
}

function formatVolume(volume?: number): string | undefined {
  if (!volume) return undefined;
  if (volume >= 10_000) return `${(volume / 10_000).toFixed(2)}万 交易额`;
  return `${Math.round(volume)} 交易额`;
}
