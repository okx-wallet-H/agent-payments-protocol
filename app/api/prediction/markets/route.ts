import { NextResponse } from "next/server";
import { getPredictionRouterInfo, listPredictionMarketsViaRouter, normalizePredictionKeyword } from "@/lib/onchainos-router";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const keyword = normalizePredictionKeyword(url.searchParams.get("keyword"));
  const limit = Number(url.searchParams.get("limit") || 10);
  if (!keyword) {
    const router = getPredictionRouterInfo();
    return NextResponse.json(
      {
        router,
        provider: "polymarket-plugin",
        liveTradingEnabled: router.liveTradingEnabled,
        markets: [],
        error: "keyword is required"
      },
      { status: 400 }
    );
  }

  try {
    const payload = await listPredictionMarketsViaRouter(keyword, Math.min(Math.max(limit, 1), 25));
    return NextResponse.json(payload);
  } catch (error) {
    const router = getPredictionRouterInfo();
    return NextResponse.json(
      {
        router,
        provider: "polymarket-plugin",
        liveTradingEnabled: router.liveTradingEnabled,
        markets: [],
        error: error instanceof Error ? error.message : "Failed to read prediction markets"
      },
      { status: 503 }
    );
  }
}
