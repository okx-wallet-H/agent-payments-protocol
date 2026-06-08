import { NextResponse } from "next/server";
import { handlePhaseOneUserText } from "@/v2/agent/conversation-turn";
import { PHASE_ONE_APP_SHELL } from "@/v2/app/app-shell";
import { createMobileChatTurn } from "@/v2/app/mobile-chat";
import { createUserConsolePanel } from "@/v2/app/user-console";
import { createWorldCupInfoPanel } from "@/v2/app/world-cup-info";
import { listWorldCupMarkets, getWorldCupCandidateMarket } from "@/v2/execution/polymarket-cli";
import { readWalletAddressFromUrl, resolveReceiveWalletAddress } from "@/v2/wallet/receive-wallet";

export const runtime = "nodejs";

interface PhaseOneBody {
  text?: string;
  xLayerAddress?: `0x${string}`;
  polygonAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
}

export async function GET(request: Request) {
  const markets = await readMarketsSafely();
  const walletAddress = resolveReceiveWalletAddress(readWalletAddressFromUrl(request.url));

  return NextResponse.json({
    shell: PHASE_ONE_APP_SHELL,
    panels: {
      topLeft: createWorldCupInfoPanel(markets),
      topRight: createUserConsolePanel({
        walletAddress
      })
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PhaseOneBody;
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const candidateMarket = /世界杯|world cup|预测|机会/i.test(text)
    ? await getWorldCupCandidateSafely()
    : undefined;
  const walletAddress = resolveReceiveWalletAddress(body.walletAddress || body.xLayerAddress);

  const turn = handlePhaseOneUserText({
    userText: text,
    xLayerAddress: walletAddress,
    polygonAddress: body.polygonAddress || walletAddress,
    candidateMarket
  });

  return NextResponse.json({
    turn,
    mobileTurn: createMobileChatTurn(turn)
  }, { status: 201 });
}

async function readMarketsSafely() {
  try {
    return await listWorldCupMarkets(8);
  } catch {
    return [];
  }
}

async function getWorldCupCandidateSafely() {
  try {
    return await getWorldCupCandidateMarket();
  } catch {
    return undefined;
  }
}
