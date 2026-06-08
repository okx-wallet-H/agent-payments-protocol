import { NextResponse } from "next/server";
import { createWorldCupExploreView } from "@/v2/app/world-cup-explore";
import { hasOkxOutcomesCredentials, listOkxWorldCupMarkets } from "@/v2/execution/okx-outcomes-client";
import { listWorldCupMarkets } from "@/v2/execution/polymarket-cli";

export const runtime = "nodejs";

export async function GET() {
  const markets = await readMarketsSafely();

  return NextResponse.json({
    explore: createWorldCupExploreView(markets)
  });
}

async function readMarketsSafely() {
  if (hasOkxOutcomesCredentials()) {
    try {
      const okxMarkets = await listOkxWorldCupMarkets();
      if (okxMarkets.length > 0) return okxMarkets;
    } catch (error) {
      console.warn("OKX Outcomes world cup read failed; falling back to local/plugin data.", error);
    }
  }

  try {
    return await listWorldCupMarkets(20);
  } catch {
    return [];
  }
}
