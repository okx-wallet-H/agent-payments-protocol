import { NextResponse } from "next/server";
import { createMobileHomeView } from "@/v2/app/mobile-home";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { listWorldCupMarkets } from "@/v2/execution/polymarket-cli";
import {
  listPhaseOneRecords,
  listStrategyCards,
  listTrackingCards
} from "@/v2/storage/phase-one-store";
import { readWalletAddressFromUrl, resolveReceiveWalletAddress } from "@/v2/wallet/receive-wallet";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolvePhaseOneUser(request);
  if (!user.ok) {
    return NextResponse.json({ error: user.error }, { status: user.status || 401 });
  }

  const [worldCupMarkets, tracking, strategies, records] = await Promise.all([
    readMarketsSafely(),
    listTrackingCards(user.userId),
    listStrategyCards(user.userId),
    listPhaseOneRecords(user.userId)
  ]);

  return NextResponse.json({
    home: createMobileHomeView({
      walletAddress: resolveReceiveWalletAddress(readWalletAddressFromUrl(request.url)),
      worldCupMarkets,
      tracking,
      strategies,
      records
    })
  });
}

async function readMarketsSafely() {
  try {
    return await listWorldCupMarkets(8);
  } catch {
    return [];
  }
}
