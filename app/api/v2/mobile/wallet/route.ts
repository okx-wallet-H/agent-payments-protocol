import { NextResponse } from "next/server";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { bindUserWalletSession, rememberUserSession } from "@/v2/storage/user-session-store";
import {
  createMobileWalletKnowledgeNotes,
  syncAgentWalletContext,
  toMobileWalletContext
} from "@/v2/wallet/mobile-wallet";
import { readWalletAddressFromUrl } from "@/v2/wallet/receive-wallet";
import { createAgentWalletContext } from "@/v2/wallet/wallet-orchestrator";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function GET(request: Request) {
  const user = await resolvePhaseOneUser(request);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }

  const suppliedWalletAddress = readWalletAddressFromUrl(request.url);
  const binding = await bindUserWalletSession({
    userId: user.userId,
    walletAddress: suppliedWalletAddress
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
    walletAddress: suppliedWalletAddress,
    memory
  });
  const syncedWallet = await syncAgentWalletContext(wallet, memory);

  await rememberUserSession({
    userId: user.userId,
    walletAddress: suppliedWalletAddress || memory.walletAddress,
    walletAssetSnapshot: syncedWallet.assetSnapshot,
    walletRecords: syncedWallet.recentRecords,
    knowledgeNotes: createMobileWalletKnowledgeNotes(syncedWallet)
  });

  return jsonWithCors({
    wallet: toMobileWalletContext(syncedWallet)
  });
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
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-owner-user-id"
  };
}
