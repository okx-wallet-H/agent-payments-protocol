import { NextResponse } from "next/server";
import { handlePhaseOneUserText } from "@/v2/agent/conversation-turn";
import { createMobileChatTurn } from "@/v2/app/mobile-chat";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { saveAuditTimelineEvent } from "@/v2/storage/audit-timeline-store";
import { bindUserWalletSession, findVerifiedWalletTransfer, rememberUserSession } from "@/v2/storage/user-session-store";
import { createAgentWalletContext } from "@/v2/wallet/wallet-orchestrator";
import { toUserSessionVerifiedWalletTransfer, toXLayerInboundTransfer } from "@/v2/wallet/wallet-transfer-memory";
import {
  createMobileWalletKnowledgeNotes,
  createWalletTxReply,
  syncAgentWalletContext,
  toMobileWalletContext,
  withVerifiedInboundTransfer
} from "@/v2/wallet/mobile-wallet";
import { extractTxHash, verifyXLayerInboundTransfer } from "@/v2/wallet/xlayer-transaction";

export const runtime = "nodejs";

interface WalletVerifyTxBody {
  userId?: string;
  walletAddress?: `0x${string}`;
  txHash?: string;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as WalletVerifyTxBody;
  const txHash = extractTxHash(body.txHash || "");
  if (!txHash) {
    return jsonWithCors({ error: "tx_hash_required", message: "请粘贴一笔 X Layer 交易哈希。" }, { status: 400 });
  }

  const user = await resolvePhaseOneUser(request, body);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }

  const binding = await bindUserWalletSession({
    userId: user.userId,
    walletAddress: body.walletAddress,
    userText: txHash
  });
  if (!binding.ok) {
    return jsonWithCors({
      error: "wallet_address_conflict",
      message: "当前账号已绑定一个 HWallet 地址，请刷新或重新登录后再试。"
    }, { status: 409 });
  }

  const memory = binding.memory;
  const effectiveWalletAddress = body.walletAddress || memory.walletAddress;
  if (!effectiveWalletAddress) {
    return jsonWithCors({
      error: "wallet_address_required",
      message: "请先生成或绑定 HWallet，再检查这笔交易。"
    }, { status: 400 });
  }

  const wallet = createAgentWalletContext({
    userId: user.userId,
    walletAddress: effectiveWalletAddress,
    memory
  });
  const rememberedTransfer = findVerifiedWalletTransfer(memory, txHash);
  const verification = rememberedTransfer
    ? toXLayerInboundTransfer(rememberedTransfer)
    : await verifyXLayerInboundTransfer({
        txHash,
        walletAddress: wallet.receiveAddress
      });
  const syncedWallet = withVerifiedInboundTransfer(
    await syncWalletAssetsSafely(wallet, memory),
    verification
  );
  const walletTxText = createWalletTxReply(verification);
  const turn = handlePhaseOneUserText({
    userText: txHash,
    xLayerAddress: syncedWallet.receiveAddress,
    polygonAddress: syncedWallet.receiveAddress,
    walletTxText,
    goalType: "wallet_tx_verify"
  });

  await rememberUserSession({
    userId: user.userId,
    walletAddress: body.walletAddress || memory.walletAddress,
    walletAssetSnapshot: syncedWallet.assetSnapshot,
    walletRecords: syncedWallet.recentRecords,
    verifiedWalletTransfer: rememberedTransfer ? undefined : toUserSessionVerifiedWalletTransfer(verification),
    agentText: turn.finalText,
    knowledgeNotes: createMobileWalletKnowledgeNotes(syncedWallet)
  });
  if (!rememberedTransfer) {
    await saveAuditTimelineEvent({
      userId: user.userId,
      type: "wallet.tx_verified",
      title: verification.status === "received" ? "已确认到账" : "已核验交易",
      note: `${verification.message} 未发生真实下单。`,
      status: verification.status === "received" ? "success" : "info",
      txHash: verification.txHash,
      explorerUrl: verification.explorerUrl,
      chainId: verification.chainId,
      assetSymbol: verification.assetSymbol,
      amountLabel: verification.amountLabel,
      tokenAddress: verification.tokenAddress,
      walletRecordId: verification.status === "received" ? `wallet-tx-${verification.txHash}` : undefined
    });
  }

  return jsonWithCors({
    verification: {
      ...verification,
      remembered: Boolean(rememberedTransfer)
    },
    wallet: toMobileWalletContext(syncedWallet),
    mobileTurn: createMobileChatTurn(turn)
  }, { status: 201 });
}

async function syncWalletAssetsSafely(
  wallet: ReturnType<typeof createAgentWalletContext>,
  memory?: Parameters<typeof syncAgentWalletContext>[1]
) {
  return syncAgentWalletContext(wallet, memory);
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
