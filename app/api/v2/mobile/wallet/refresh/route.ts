import { NextResponse } from "next/server";
import { createAgentOrchestrationPlan } from "@/v2/agent/orchestrator";
import { handlePhaseOneUserText } from "@/v2/agent/conversation-turn";
import { createMobileChatTurn } from "@/v2/app/mobile-chat";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { getWorldCupCandidateMarket } from "@/v2/execution/polymarket-cli";
import { saveAuditTimelineEvent } from "@/v2/storage/audit-timeline-store";
import { bindUserWalletSession, rememberUserSession } from "@/v2/storage/user-session-store";
import { createAgentWalletContext } from "@/v2/wallet/wallet-orchestrator";
import {
  createMobileWalletKnowledgeNotes,
  createWalletAuditNote,
  createWalletFundReply,
  createWalletStatusReply,
  syncAgentWalletContext,
  toMobileWalletContext
} from "@/v2/wallet/mobile-wallet";

export const runtime = "nodejs";

interface WalletRefreshBody {
  userId?: string;
  walletAddress?: `0x${string}`;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as WalletRefreshBody;
  const user = await resolvePhaseOneUser(request, body);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }

  const binding = await bindUserWalletSession({
    userId: user.userId,
    walletAddress: body.walletAddress
  });
  if (!binding.ok) {
    return jsonWithCors({
      error: "wallet_address_conflict",
      message: "当前账号已绑定一个 HWallet 地址，请刷新或重新登录后再试。"
    }, { status: 409 });
  }

  const memory = binding.memory;
  const wallet = createAgentWalletContext({
    userId: user.userId,
    walletAddress: body.walletAddress,
    memory
  });
  const syncedWallet = await syncWalletAssetsSafely(wallet, memory);
  const walletFundText = createWalletFundReply(syncedWallet);
  const orchestration = await createAgentOrchestrationPlan({
    userText: "好了，我充完了",
    wallet: syncedWallet,
    getCandidateMarket: getWorldCupCandidateSafely,
    walletStatusText: createWalletStatusReply(syncedWallet),
    walletFundText
  });

  const turn = handlePhaseOneUserText({
    userText: "刷新 HWallet",
    xLayerAddress: syncedWallet.receiveAddress,
    polygonAddress: syncedWallet.receiveAddress,
    candidateMarket: orchestration.candidateMarket,
    walletStatusText: orchestration.walletStatusText,
    walletFundText: orchestration.walletFundText,
    goalType: orchestration.goalType
  });

  await rememberUserSession({
    userId: user.userId,
    walletAddress: body.walletAddress || memory.walletAddress,
    walletAssetSnapshot: syncedWallet.assetSnapshot,
    walletRecords: syncedWallet.recentRecords,
    agentText: turn.finalText,
    knowledgeNotes: createMobileWalletKnowledgeNotes(syncedWallet)
  });
  await saveAuditTimelineEvent({
    userId: user.userId,
    type: "wallet.refresh",
    title: "已检查 HWallet",
    note: createWalletAuditNote(syncedWallet),
    status: "success",
    walletRecordId: syncedWallet.recentRecords[0]?.id
  });

  return jsonWithCors({
    wallet: toMobileWalletContext(syncedWallet),
    mobileTurn: createMobileChatTurn(turn)
  });
}

async function syncWalletAssetsSafely(
  wallet: ReturnType<typeof createAgentWalletContext>,
  memory?: Parameters<typeof syncAgentWalletContext>[1]
) {
  return syncAgentWalletContext(wallet, memory);
}

async function getWorldCupCandidateSafely() {
  try {
    return await getWorldCupCandidateMarket();
  } catch {
    return undefined;
  }
}

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(),
      ...(init?.headers || {})
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-owner-user-id"
  };
}
