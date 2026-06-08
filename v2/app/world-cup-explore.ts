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
  displayTitle: string;
  displayName: string;
  subtitle?: string;
  agentNote?: string;
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
  const category = inferWorldCupCategory(market);
  const display = friendlyWorldCupDisplay(market.question);

  return {
    id: market.marketId,
    category,
    title: display.title,
    displayTitle: display.title,
    displayName: display.name,
    subtitle: market.endDate ? `结束时间 ${market.endDate}` : undefined,
    agentNote: createAgentNote(category, market),
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

function createAgentNote(category: WorldCupExploreCategory, market: MarketSnapshot): string {
  const price = market.yesPrice ?? 0;
  const volume = market.volume24h || market.volume || 0;
  const isHot = volume >= 100_000 || price >= 0.45;
  const isLongShot = price > 0 && price <= 0.12;

  if (category === "golden_boot") {
    return isHot ? "射手盘热度在前排，先看出场稳定性。" : "金靴盘波动快，适合让 Agent 先盯着。";
  }

  if (category === "group_stage") {
    return isHot ? "小组盘热度不错，临场阵容会影响判断。" : "小组盘先观察赛程，不急着下结论。";
  }

  if (category === "upcoming_matches") {
    return "比赛盘变化快，开赛前再看资金和赔率。";
  }

  if (isLongShot) return "赔率更轻，适合先放进观察列表。";
  if (isHot) return "热度靠前，先让 Agent 继续盯价格变化。";
  return "数据已经同步，先观察热度和资金变化。";
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

function friendlyWorldCupDisplay(question: string): { title: string; name: string } {
  const normalized = question.trim().replace(/\s+/g, " ");

  const goldenBoot = normalized.match(/^Will (.+) win the 2026 World Cup Golden Boot\??$/i);
  if (goldenBoot) {
    const name = friendlyName(goldenBoot[1]);
    return { title: `${name}会拿到 2026 年世界杯金靴吗？`, name };
  }

  const champion = normalized.match(/^Will (.+) win the 2026 (?:FIFA )?World Cup\??$/i);
  if (champion) {
    const name = friendlyName(champion[1]);
    return { title: `${name}会赢得 2026 年世界杯冠军吗？`, name };
  }

  const groupFirst = normalized.match(/^Will (.+) finish first in Group ([A-Z]) at the 2026 World Cup\??$/i);
  if (groupFirst) {
    const name = friendlyName(groupFirst[1]);
    return { title: `${name}会在 2026 年世界杯 ${groupFirst[2]} 组排名第一吗？`, name };
  }

  const matchWinner = normalized.match(/^Will (.+) beat (.+) at the 2026 World Cup\??$/i);
  if (matchWinner) {
    const name = friendlyName(matchWinner[1]);
    return { title: `${name}会在 2026 年世界杯战胜${friendlyName(matchWinner[2])}吗？`, name };
  }

  return { title: question, name: question.replace(/\?$/, "").slice(0, 18) || "世界杯" };
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
