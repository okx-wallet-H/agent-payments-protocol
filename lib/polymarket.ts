import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PredictionMarket } from "./types";

const execFileAsync = promisify(execFile);

interface PolymarketCliMarket {
  condition_id?: string;
  question?: string;
  slug?: string;
  accepting_orders?: boolean;
  yes_price?: string;
  no_price?: string;
  last_trade_price?: number;
  liquidity?: number;
  volume_24hr?: number;
  end_date?: string;
}

interface PolymarketCliResponse {
  ok?: boolean;
  data?: {
    markets?: PolymarketCliMarket[];
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function sanitizeText(value: unknown): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 500);
}

export async function listPolymarketMarkets(keyword = "World Cup", limit = 10): Promise<PredictionMarket[]> {
  const args = ["list-markets", "--limit", String(limit), "--keyword", keyword];
  const { stdout } = await execFileAsync("polymarket-plugin", args, {
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });
  const parsed = JSON.parse(stdout) as PolymarketCliResponse;
  if (!parsed.ok) throw new Error("Polymarket plugin returned an unsuccessful response");

  return (parsed.data?.markets || []).map((market) => ({
    id: sanitizeText(market.condition_id || market.slug),
    provider: "polymarket",
    question: sanitizeText(market.question),
    slug: sanitizeText(market.slug),
    acceptingOrders: Boolean(market.accepting_orders),
    yesPrice: toNumber(market.yes_price),
    noPrice: toNumber(market.no_price),
    lastTradePrice: market.last_trade_price,
    liquidity: market.liquidity,
    volume24hr: market.volume_24hr,
    endDate: market.end_date
  }));
}
