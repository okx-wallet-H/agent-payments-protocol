import { NextResponse } from "next/server";
import { createPredictionDetailView } from "@/v2/app/prediction-detail-view";
import { guardPredictionReadRequest } from "@/v2/auth/prediction-read-guard";
import {
  getOkxOutcomeMarketData,
  hasOkxOutcomesCredentials,
  type OkxOutcomeCandle,
  type OkxOutcomeMarketData,
  type OkxOutcomeOrderBook
} from "@/v2/execution/okx-outcomes-client";
import { normalizeOkxOutcomes } from "@/v2/execution/okx-outcomes-output";
import { sampleOkxWorldCupPayload } from "@/v2/execution/okx-world-cup-sample";
import type { MarketSnapshot } from "@/v2/domain/types";

export const runtime = "nodejs";

type DetailMode = "auto" | "live" | "sample";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketId = url.searchParams.get("marketId")?.trim();

  if (!marketId) {
    return NextResponse.json(
      {
        error: "market_id_required",
        message: "marketId is required"
      },
      { status: 400 }
    );
  }

  const guard = await guardPredictionReadRequest(request, { route: "prediction-detail" });
  if (!guard.ok) {
    return NextResponse.json(guard.body, {
      status: guard.status,
      headers: guard.headers
    });
  }

  const mode = readDetailMode(url);
  const credentialsBound = hasOkxOutcomesCredentials();
  const data = await readPredictionDetailSafely(marketId, mode);
  const liveCandidate = isOutcomeMarketData(data) && data.market?.marketId === marketId;
  const sourceMode = liveCandidate && mode !== "sample" && credentialsBound ? "live_or_fallback" : "sample";

  return NextResponse.json(
    {
      detail: createPredictionDetailView(data),
      source: {
        mode: sourceMode,
        providerStatus: credentialsBound ? "connected" : "not_configured",
        credentialsBound,
        apiKeyBindingLabel: credentialsBound ? "后端已接入" : "绑定入口预留",
        readOnly: true,
        liveExecutionClosed: true
      }
    },
    {
      headers: guard.headers
    }
  );
}

async function readPredictionDetailSafely(marketId: string, mode: DetailMode): Promise<MarketSnapshot | OkxOutcomeMarketData> {
  if (mode !== "sample" && hasOkxOutcomesCredentials()) {
    try {
      const data = await getOkxOutcomeMarketData(marketId, {
        includeCandles: true,
        includeOrderBook: true,
        candleLimit: 24,
        bookSize: 20
      });
      if (data.market) return data;
    } catch (error) {
      console.warn("OKX Outcomes prediction detail read failed; using sample detail.", error);
      if (mode === "live") return sampleDetailData(marketId);
    }
  }

  return sampleDetailData(marketId);
}

function readDetailMode(url: URL): DetailMode {
  const value = (url.searchParams.get("mode") || process.env.OKX_OUTCOMES_DETAIL_MODE || "").trim().toLowerCase();
  if (value === "live" || value === "sample") return value;
  return "auto";
}

function sampleDetailData(marketId: string): OkxOutcomeMarketData {
  const markets = normalizeOkxOutcomes(sampleOkxWorldCupPayload).markets;
  const market = markets.find((item) => item.marketId === marketId) || markets[0];
  const yesPrice = market.yesPrice ?? 0.5;
  const noPrice = market.noPrice ?? Math.max(0, 1 - yesPrice);

  return {
    marketId: market.marketId,
    market,
    yesCandles: createSampleCandles(market.yesAssetId || `${market.marketId}-yes`, yesPrice, 1),
    noCandles: createSampleCandles(market.noAssetId || `${market.marketId}-no`, noPrice, -1),
    yesOrderBook: createSampleBook(market.yesAssetId || `${market.marketId}-yes`, yesPrice),
    noOrderBook: createSampleBook(market.noAssetId || `${market.marketId}-no`, noPrice)
  };
}

function createSampleCandles(instId: string, centerPrice: number, bias: 1 | -1): OkxOutcomeCandle[] {
  const normalized = Number.isFinite(centerPrice) ? Math.max(0.01, Math.min(0.99, centerPrice)) : 0.5;
  const now = Date.now();
  return Array.from({ length: 6 }, (_, index) => {
    const drift = (index - 5) * 0.004 * bias;
    const close = Math.max(0.01, Math.min(0.99, normalized + drift));
    return {
      instId,
      timestamp: new Date(now - (5 - index) * 15 * 60_000).toISOString(),
      open: Math.max(0.01, Math.min(0.99, close - 0.003 * bias)),
      high: Math.min(0.99, close + 0.006),
      low: Math.max(0.01, close - 0.006),
      close,
      volume: 100 + index * 18,
      raw: { source: "local-sample", readOnly: true }
    };
  });
}

function createSampleBook(instId: string, centerPrice: number): OkxOutcomeOrderBook {
  const normalized = Number.isFinite(centerPrice) ? Math.max(0.01, Math.min(0.99, centerPrice)) : 0.5;
  const bestBid = Math.max(0.01, normalized - 0.02);
  const bestAsk = Math.min(0.99, normalized + 0.02);

  return {
    instId,
    bids: [
      { price: bestBid, size: 120 },
      { price: Math.max(0.01, bestBid - 0.03), size: 80 },
      { price: Math.max(0.01, bestBid - 0.06), size: 45 }
    ],
    asks: [
      { price: bestAsk, size: 110 },
      { price: Math.min(0.99, bestAsk + 0.03), size: 76 },
      { price: Math.min(0.99, bestAsk + 0.06), size: 44 }
    ],
    timestamp: new Date().toISOString(),
    raw: { source: "local-sample", readOnly: true }
  };
}

function isOutcomeMarketData(value: MarketSnapshot | OkxOutcomeMarketData): value is OkxOutcomeMarketData {
  return "marketId" in value && "market" in value;
}
