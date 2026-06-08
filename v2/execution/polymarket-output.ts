import type { MarketSnapshot } from "../domain/types";

interface PolymarketListMarketsOutput {
  ok?: boolean;
  data?: {
    markets?: PolymarketCliMarket[];
  };
}

interface PolymarketCliMarket {
  accepting_orders?: boolean;
  condition_id?: string;
  end_date?: string;
  liquidity?: number;
  no_price?: string | number;
  question?: string;
  slug?: string;
  volume_24hr?: number;
  yes_price?: string | number;
}

export function mapPolymarketMarkets(output: unknown): MarketSnapshot[] {
  const data = output as PolymarketListMarketsOutput;
  return (data.data?.markets || []).map(mapPolymarketMarket).filter((market): market is MarketSnapshot => Boolean(market));
}

export function pickBestWorldCupMarket(markets: MarketSnapshot[]): MarketSnapshot | undefined {
  return markets
    .filter((market) => market.acceptingOrders)
    .sort((a, b) => marketScore(b) - marketScore(a))[0];
}

function mapPolymarketMarket(market: PolymarketCliMarket): MarketSnapshot | undefined {
  if (!market.condition_id || !market.question) return undefined;

  return {
    provider: "polymarket-plugin",
    chainId: 137,
    marketId: market.condition_id,
    question: market.question,
    yesPrice: parsePrice(market.yes_price),
    noPrice: parsePrice(market.no_price),
    acceptingOrders: Boolean(market.accepting_orders),
    liquidity: market.liquidity,
    volume24h: market.volume_24hr,
    endDate: market.end_date
  };
}

function parsePrice(value: string | number | undefined): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function marketScore(market: MarketSnapshot): number {
  const liquidity = market.liquidity || 0;
  const volume = market.volume24h || 0;
  const priceBalance = 1 - Math.abs((market.yesPrice || 0.5) - 0.5);
  return Math.log10(1 + liquidity) + Math.log10(1 + volume) + priceBalance;
}
