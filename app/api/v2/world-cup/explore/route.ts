import { NextResponse } from "next/server";
import { createWorldCupExploreView } from "@/v2/app/world-cup-explore";
import { listWorldCupMarkets } from "@/v2/execution/polymarket-cli";

export const runtime = "nodejs";

export async function GET() {
  const markets = await readMarketsSafely();

  return NextResponse.json({
    explore: createWorldCupExploreView(markets)
  });
}

async function readMarketsSafely() {
  try {
    return await listWorldCupMarkets(20);
  } catch {
    return [];
  }
}
