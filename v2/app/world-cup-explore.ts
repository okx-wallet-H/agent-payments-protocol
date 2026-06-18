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
  timing?: {
    status: "live" | "soon" | "today" | "upcoming" | "ended" | "unknown";
    label: string;
    startTime?: string;
  };
  probabilityLabel?: string;
  volumeLabel?: string;
  status: "observable" | "watch_only";
  market: MarketSnapshot;
  options: WorldCupExploreOption[];
}

export type WorldCupExploreSourceProvider = "okx-outcomes" | "polymarket-plugin" | "local-sample";

export interface WorldCupExploreSource {
  provider: WorldCupExploreSourceProvider;
  mode: "live" | "fallback" | "sample";
  label: string;
  message: string;
  providerStatus: "connected" | "not_configured" | "sample";
  credentialsBound: boolean;
  updatedAt: string;
  warning?: string;
}

export interface WorldCupExploreView {
  type: "world_cup_explore_view";
  categories: Array<{
    id: WorldCupExploreCategory;
    label: string;
  }>;
  cards: Record<WorldCupExploreCategory, WorldCupExploreMarketCard[]>;
  summary: {
    totalMarkets: number;
    categoryCounts: Record<WorldCupExploreCategory, number>;
  };
  source: WorldCupExploreSource;
  updatedAt: string;
}

const categories: WorldCupExploreView["categories"] = [
  { id: "champion", label: "冠军" },
  { id: "golden_boot", label: "金靴奖得主" },
  { id: "group_stage", label: "小组赛" },
  { id: "upcoming_matches", label: "近期比赛" }
];

export function createWorldCupExploreView(
  markets: MarketSnapshot[],
  source: WorldCupExploreSource = createWorldCupExploreSource("local-sample", "sample")
): WorldCupExploreView {
  const cards = markets.map(toExploreCard);
  const updatedAt = new Date().toISOString();
  const groupedCards = {
    champion: sortExploreCards(cards.filter((card) => card.category === "champion")),
    golden_boot: sortExploreCards(cards.filter((card) => card.category === "golden_boot")),
    group_stage: sortExploreCards(cards.filter((card) => card.category === "group_stage")),
    upcoming_matches: sortExploreCards(cards.filter((card) => card.category === "upcoming_matches"))
  };

  return {
    type: "world_cup_explore_view",
    categories,
    cards: groupedCards,
    summary: {
      totalMarkets: cards.length,
      categoryCounts: {
        champion: groupedCards.champion.length,
        golden_boot: groupedCards.golden_boot.length,
        group_stage: groupedCards.group_stage.length,
        upcoming_matches: groupedCards.upcoming_matches.length
      }
    },
    source: { ...source, updatedAt },
    updatedAt
  };
}

function sortExploreCards(cards: WorldCupExploreMarketCard[]): WorldCupExploreMarketCard[] {
  return cards.slice().sort((a, b) => {
    if (a.category === "upcoming_matches" || b.category === "upcoming_matches") {
      const timeDelta = upcomingSortScore(a) - upcomingSortScore(b);
      if (timeDelta !== 0) return timeDelta;
    }

    const volumeDelta = marketVolumeScore(b.market) - marketVolumeScore(a.market);
    if (volumeDelta !== 0) return volumeDelta;

    const statusDelta = Number(b.market.acceptingOrders) - Number(a.market.acceptingOrders);
    if (statusDelta !== 0) return statusDelta;

    return (b.market.yesPrice || 0) - (a.market.yesPrice || 0);
  });
}

function upcomingSortScore(card: WorldCupExploreMarketCard): number {
  const time = parseMarketTime(card.market.startTime);
  if (!time) return Number.MAX_SAFE_INTEGER;
  const now = Date.now();
  const diffMs = time.getTime() - now;
  if (diffMs <= 0 && diffMs >= -3 * 60 * 60 * 1000) return -1;
  if (diffMs > 0) return diffMs;
  return Number.MAX_SAFE_INTEGER - Math.min(Math.abs(diffMs), 10_000_000_000);
}

function marketVolumeScore(market: MarketSnapshot): number {
  return market.volume24h || market.volume || market.liquidity || 0;
}

export function createWorldCupExploreSource(
  provider: WorldCupExploreSourceProvider,
  mode: WorldCupExploreSource["mode"],
  warning?: string
): WorldCupExploreSource {
  const labelByProvider: Record<WorldCupExploreSourceProvider, string> = {
    "okx-outcomes": "OKX 实时同步",
    "polymarket-plugin": "插件数据同步",
    "local-sample": "赛事样例"
  };
  const messageByProvider: Record<WorldCupExploreSourceProvider, string> = {
    "okx-outcomes": "数据已从 OKX Outcomes 同步，Agent 会按最新市场继续观察。",
    "polymarket-plugin": "先用插件数据展示赛事机会，OKX 数据同步后会自动切换。",
    "local-sample": "先展示世界杯样例数据，真实赛事数据接入后自动替换。"
  };

  return {
    provider,
    mode,
    label: labelByProvider[provider],
    message: messageByProvider[provider],
    providerStatus: provider === "okx-outcomes" ? "connected" : provider === "local-sample" ? "sample" : "not_configured",
    credentialsBound: provider === "okx-outcomes",
    updatedAt: new Date().toISOString(),
    warning
  };
}

export function inferWorldCupCategory(market: MarketSnapshot): WorldCupExploreCategory {
  const question = market.question.toLowerCase();
  if (/(golden boot|金靴|top scorer|最佳射手)/i.test(question)) return "golden_boot";
  if (/(win the .*world cup|world cup winner|世界杯冠军|赢得.*世界杯|夺冠)/i.test(question)) return "champion";
  if (/( vs | v |\bdraw\b|beat|战胜|平局|match|比赛)/i.test(question)) return "upcoming_matches";

  const text = `${question} ${market.raw ? JSON.stringify(market.raw).slice(0, 500) : ""}`.toLowerCase();
  if (/(golden boot|金靴|top scorer|最佳射手)/i.test(text)) return "golden_boot";
  if (/(group|组第一|小组|小组赛)/i.test(text)) return "group_stage";
  if (/( vs | v |\\bdraw\\b|beat|战胜|平局|近期|match|比赛)/i.test(text)) return "upcoming_matches";
  return "champion";
}

function toExploreCard(market: MarketSnapshot): WorldCupExploreMarketCard {
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;
  const category = inferWorldCupCategory(market);
  const display = friendlyWorldCupDisplay(market.question);
  const timing = createWorldCupMarketTiming(market);

  return {
    id: market.marketId,
    category,
    title: display.title,
    displayTitle: display.title,
    displayName: display.name,
    subtitle: timing?.label || (market.endDate ? `结束时间 ${market.endDate}` : undefined),
    agentNote: createWorldCupAgentNote(category, market),
    timing,
    probabilityLabel: yesPrice === undefined ? undefined : `${Math.round(yesPrice * 100)}%`,
    volumeLabel: formatVolume(market.volume24h || market.volume),
    status: market.acceptingOrders ? "observable" : "watch_only",
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

export function createWorldCupMarketTiming(market: MarketSnapshot): WorldCupExploreMarketCard["timing"] {
  const start = parseMarketTime(market.startTime);
  if (!start) return undefined;

  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const oneHour = 60 * 60 * 1000;
  const threeHours = 3 * oneHour;
  const sameDay =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  const startLabel = formatStartTime(start);

  if (diffMs <= 0 && diffMs >= -threeHours) {
    return { status: "live", label: `进行中 · ${startLabel}`, startTime: start.toISOString() };
  }
  if (diffMs > 0 && diffMs <= oneHour) {
    return { status: "soon", label: `马上开赛 · ${startLabel}`, startTime: start.toISOString() };
  }
  if (sameDay && diffMs > 0) {
    return { status: "today", label: `今日开赛 · ${startLabel}`, startTime: start.toISOString() };
  }
  if (diffMs < -threeHours) {
    return { status: "ended", label: `已开赛 · ${startLabel}`, startTime: start.toISOString() };
  }
  return { status: "upcoming", label: `即将开始 · ${startLabel}`, startTime: start.toISOString() };
}

export function createWorldCupAgentNote(category: WorldCupExploreCategory, market: MarketSnapshot): string {
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
    const timing = createWorldCupMarketTiming(market);
    if (timing?.status === "live") return "比赛已经开始，Agent 优先看临场资金和价格变化。";
    if (timing?.status === "soon") return "马上开赛，适合先让 Agent 做临场观察。";
    if (timing?.status === "today") return "今日比赛，先看首发、热度和盘口变化。";
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

function parseMarketTime(value?: string): Date | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatStartTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function friendlyWorldCupDisplay(question: string): { title: string; name: string } {
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
  "south africa": "南非",
  "south korea": "韩国",
  spain: "西班牙",
  switzerland: "瑞士",
  czechia: "捷克",
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
