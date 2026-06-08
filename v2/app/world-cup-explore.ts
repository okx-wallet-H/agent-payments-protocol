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
  const question = market.question.toLowerCase();
  if (/(golden boot|金靴|top scorer|最佳射手)/i.test(question)) return "golden_boot";
  if (/(win the .*world cup|world cup winner|世界杯冠军|赢得.*世界杯|夺冠)/i.test(question)) return "champion";
  if (/( vs | v |\bdraw\b|平局|match|比赛)/i.test(question)) return "upcoming_matches";

  const text = `${question} ${market.raw ? JSON.stringify(market.raw).slice(0, 500) : ""}`.toLowerCase();
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
    title: friendlyWorldCupTitle(market.question),
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

function friendlyWorldCupTitle(question: string): string {
  const normalized = question.trim().replace(/\s+/g, " ");

  const goldenBoot = normalized.match(/^Will (.+) win the 2026 World Cup Golden Boot\??$/i);
  if (goldenBoot) return `${friendlyName(goldenBoot[1])}会拿到 2026 年世界杯金靴吗？`;

  const champion = normalized.match(/^Will (.+) win the 2026 (?:FIFA )?World Cup\??$/i);
  if (champion) return `${friendlyName(champion[1])}会赢得 2026 年世界杯冠军吗？`;

  const groupFirst = normalized.match(/^Will (.+) finish first in Group ([A-Z]) at the 2026 World Cup\??$/i);
  if (groupFirst) return `${friendlyName(groupFirst[1])}会在 2026 年世界杯 ${groupFirst[2]} 组排名第一吗？`;

  const matchWinner = normalized.match(/^Will (.+) beat (.+) at the 2026 World Cup\??$/i);
  if (matchWinner) return `${friendlyName(matchWinner[1])}会在 2026 年世界杯战胜${friendlyName(matchWinner[2])}吗？`;

  return question;
}

function friendlyName(name: string): string {
  return nameMap[name.trim().toLowerCase()] || name.trim();
}

const nameMap: Record<string, string> = {
  argentina: "阿根廷",
  australia: "澳大利亚",
  belgium: "比利时",
  brazil: "巴西",
  canada: "加拿大",
  chile: "智利",
  colombia: "哥伦比亚",
  croatia: "克罗地亚",
  denmark: "丹麦",
  ecuador: "厄瓜多尔",
  england: "英格兰",
  france: "法国",
  germany: "德国",
  ghana: "加纳",
  italy: "意大利",
  japan: "日本",
  mexico: "墨西哥",
  morocco: "摩洛哥",
  netherlands: "荷兰",
  nigeria: "尼日利亚",
  norway: "挪威",
  paraguay: "巴拉圭",
  portugal: "葡萄牙",
  senegal: "塞内加尔",
  spain: "西班牙",
  switzerland: "瑞士",
  türkiye: "土耳其",
  turkey: "土耳其",
  "united states": "美国",
  uruguay: "乌拉圭",
  "kylian mbappe": "姆巴佩",
  "harry kane": "哈里·凯恩",
  "erling haaland": "哈兰德",
  "mikel oyarzabal": "奥亚萨瓦尔",
  "cristiano ronaldo": "C 罗",
  "lionel messi": "梅西",
  "julian alvarez": "阿尔瓦雷斯",
  raphinha: "拉菲尼亚",
  "vinicius jr": "维尼修斯",
  "vinícius júnior": "维尼修斯",
  "lamine yamal": "亚马尔",
  "bukayo saka": "萨卡",
  "jude bellingham": "贝林厄姆",
  "phil foden": "福登",
  "antoine griezmann": "格列兹曼",
  "lautaro martinez": "劳塔罗",
  "robert lewandowski": "莱万多夫斯基",
  "mohamed salah": "萨拉赫",
  "victor osimhen": "奥斯梅恩"
};
