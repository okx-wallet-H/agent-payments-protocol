import { NextResponse } from "next/server";
import { executeAgentCapabilitySafely, type AgentCapabilityExecutionResult } from "@/v2/agent/mcp-capability-executor";
import { createAgentOrchestrationPlan } from "@/v2/agent/orchestrator";
import { handlePhaseOneUserText } from "@/v2/agent/conversation-turn";
import { PHASE_ONE_APP_SHELL } from "@/v2/app/app-shell";
import { createMobileChatTurn } from "@/v2/app/mobile-chat";
import { createUserConsolePanel } from "@/v2/app/user-console";
import { createWorldCupInfoPanel } from "@/v2/app/world-cup-info";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { normalizeOkxOutcomes, pickBestOkxWorldCupMarket } from "@/v2/execution/okx-outcomes-output";
import { sampleOkxWorldCupPayload } from "@/v2/execution/okx-world-cup-sample";
import { listWorldCupMarkets, getWorldCupCandidateMarket } from "@/v2/execution/polymarket-cli";
import { saveAgentAction, saveAgentRun } from "@/v2/storage/agent-action-store";
import { saveAuditTimelineEvent } from "@/v2/storage/audit-timeline-store";
import { savePhaseOneRecord } from "@/v2/storage/phase-one-store";
import { bindUserWalletSession, findVerifiedWalletTransfer, loadUserSession, rememberUserSession } from "@/v2/storage/user-session-store";
import { createAgentWalletContext } from "@/v2/wallet/wallet-orchestrator";
import { toUserSessionVerifiedWalletTransfer, toXLayerInboundTransfer } from "@/v2/wallet/wallet-transfer-memory";
import {
  createMobileWalletKnowledgeNotes,
  createWalletFundReply,
  createWalletStatusReply,
  createWalletTxReply,
  syncAgentWalletContext,
  toMobileWalletContext,
  withVerifiedInboundTransfer
} from "@/v2/wallet/mobile-wallet";
import { readWalletAddressFromUrl } from "@/v2/wallet/receive-wallet";
import { extractTxHash, verifyXLayerInboundTransfer, type XLayerInboundTransfer } from "@/v2/wallet/xlayer-transaction";
import type { MarketSnapshot } from "@/v2/domain/types";

export const runtime = "nodejs";

interface PhaseOneBody {
  text?: string;
  ownerUserId?: string;
  userId?: string;
  xLayerAddress?: `0x${string}`;
  polygonAddress?: `0x${string}`;
  walletAddress?: `0x${string}`;
  candidateMarket?: unknown;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function GET(request: Request) {
  const markets = await readMarketsSafely();
  const user = await resolvePhaseOneUser(request);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }
  const suppliedWalletAddress = readWalletAddressFromUrl(request.url);
  const binding = await bindUserWalletSession({
    userId: user.userId,
    walletAddress: suppliedWalletAddress,
    homeLoad: true
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

  return jsonWithCors({
    shell: PHASE_ONE_APP_SHELL,
    panels: {
      topLeft: createWorldCupInfoPanel(markets),
      topRight: createUserConsolePanel({
        walletAddress: wallet.receiveAddress
      })
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PhaseOneBody;
  const text = body.text?.trim();
  if (!text) {
    return jsonWithCors({ error: "text is required" }, { status: 400 });
  }
  const user = await resolvePhaseOneUser(request, body);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }

  const suppliedMarket = readCandidateMarket(body.candidateMarket);
  const suppliedWalletAddress = body.walletAddress || body.xLayerAddress;
  const submittedTxHash = extractTxHash(text);
  const existingMemory = submittedTxHash ? await loadUserSession(user.userId) : undefined;
  if (submittedTxHash && !suppliedWalletAddress && !existingMemory?.walletAddress) {
    return jsonWithCors({
      error: "wallet_address_required",
      message: "请先生成或绑定 HWallet，再检查这笔交易。"
    }, { status: 400 });
  }

  const binding = await bindUserWalletSession({
    userId: user.userId,
    walletAddress: suppliedWalletAddress,
    userText: text
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
  const syncedWallet = await syncWalletAssetsSafely(wallet, memory);
  const rememberedTransfer = submittedTxHash ? findVerifiedWalletTransfer(memory, submittedTxHash) : undefined;
  const txVerification = rememberedTransfer
    ? toXLayerInboundTransfer(rememberedTransfer)
    : await verifySubmittedTxSafely(text, syncedWallet.receiveAddress);
  const walletAfterTxVerification = txVerification
    ? withVerifiedInboundTransfer(syncedWallet, txVerification)
    : syncedWallet;
  const walletTxText = txVerification ? createWalletTxReply(txVerification) : undefined;
  const orchestration = await createAgentOrchestrationPlan({
    userText: text,
    wallet: walletAfterTxVerification,
    candidateMarket: suppliedMarket,
    getCandidateMarket: getWorldCupCandidateSafely,
    walletStatusText: createWalletStatusReply(walletAfterTxVerification),
    walletFundText: walletTxText || createWalletFundReply(walletAfterTxVerification)
  });
  const capabilityResult = await executeAgentCapabilitySafely({
    userText: text,
    walletAddress: walletAfterTxVerification.receiveAddress,
    orchestration
  });

  const turn = handlePhaseOneUserText({
    userText: text,
    xLayerAddress: walletAfterTxVerification.receiveAddress,
    polygonAddress: body.polygonAddress || walletAfterTxVerification.receiveAddress,
    candidateMarket: orchestration.candidateMarket,
    walletStatusText: orchestration.walletStatusText,
    walletFundText: orchestration.walletFundText,
    walletTxText,
    goalType: orchestration.goalType
  });
  await rememberUserSession({
    userId: user.userId,
    walletAddress: body.walletAddress || body.xLayerAddress || memory.walletAddress,
    walletAssetSnapshot: walletAfterTxVerification.assetSnapshot,
    walletRecords: walletAfterTxVerification.recentRecords,
    verifiedWalletTransfer: txVerification && !rememberedTransfer
      ? toUserSessionVerifiedWalletTransfer(txVerification)
      : undefined,
    agentText: turn.finalText,
    knowledgeNotes: createMobileWalletKnowledgeNotes(walletAfterTxVerification)
  });
  if (turn.goal.type === "prediction_market_research") {
    const predictionCard = turn.cards.find((card) => card.type === "prediction_card");
    let predictionRecord: Awaited<ReturnType<typeof savePhaseOneRecord>> | undefined;
    if (predictionCard) {
      predictionRecord = await savePhaseOneRecord({
        userId: user.userId,
        idempotencyKey: `prediction:${user.userId}:${predictionCard.market.marketId}`,
        type: "prediction.saved",
        title: predictionCard.title,
        note: predictionCard.agentNote,
        card: predictionCard
      });
    }
    await saveAuditTimelineEvent({
      userId: user.userId,
      type: "prediction.analyzed",
      title: "已生成预测分析",
      note: orchestration.candidateMarket ? "Agent 已读取市场并生成预测卡，未发生真实下单。" : "Agent 已进入市场分析，未发生资金动作。",
      status: "success",
      marketId: orchestration.candidateMarket?.marketId,
      marketTitle: orchestration.candidateMarket?.question,
      recordId: predictionRecord?.id
    });
  }
  if (txVerification && !rememberedTransfer) {
    await saveAuditTimelineEvent({
      userId: user.userId,
      type: "wallet.tx_verified",
      title: txVerification.status === "received" ? "已确认到账" : "已核验交易",
      note: `${txVerification.message} 未发生真实下单。`,
      status: txVerification.status === "received" ? "success" : "info",
      txHash: txVerification.txHash,
      explorerUrl: txVerification.explorerUrl,
      chainId: txVerification.chainId,
      assetSymbol: txVerification.assetSymbol,
      amountLabel: txVerification.amountLabel,
      tokenAddress: txVerification.tokenAddress,
      walletRecordId: txVerification.status === "received" ? `wallet-tx-${txVerification.txHash}` : undefined
    });
  }
  await saveOrchestrationRecord({
    userId: user.userId,
    userText: text,
    walletStatus: walletAfterTxVerification.status,
    submittedTxHash,
    orchestration,
    capabilityResult,
    turnId: turn.id
  });

  return jsonWithCors({
    turn,
    mobileTurn: createMobileChatTurn(turn),
    wallet: toMobileWalletContext(walletAfterTxVerification),
    orchestration: {
      action: orchestration.action,
      goalType: orchestration.goalType,
      progressHint: orchestration.progressHint,
      capability: orchestration.capability
    },
    capabilityResult
  }, { status: 201 });
}

async function saveOrchestrationRecord(input: {
  userId: string;
  userText: string;
  walletStatus: string;
  submittedTxHash?: `0x${string}`;
  orchestration: Awaited<ReturnType<typeof createAgentOrchestrationPlan>>;
  capabilityResult?: AgentCapabilityExecutionResult;
  turnId: string;
}) {
  const status = input.orchestration.capability.onchainSkill.status === "blocked" ? "blocked" : "completed";
  const finishedAt = new Date().toISOString();
  const run = await saveAgentRun({
    userId: input.userId,
    intent: input.userText,
    status,
    input: {
      text: input.userText,
      walletStatus: input.walletStatus,
      submittedTxHash: input.submittedTxHash,
      candidateMarketId: input.orchestration.candidateMarket?.marketId
    },
    output: {
      turnId: input.turnId,
      action: input.orchestration.action,
      goalType: input.orchestration.goalType,
      progressHint: input.orchestration.progressHint,
      capabilityResult: input.capabilityResult,
      moneyMoved: false
    },
    finishedAt
  });
  await saveAgentAction({
    userId: input.userId,
    runId: run.id,
    action: input.orchestration.action,
    status,
    capability: toJsonObject(input.orchestration.capability),
    policyResult: toJsonObject(input.orchestration.capability.policyDecision),
    moneyMoved: false,
    createdAt: finishedAt
  });
}

async function verifySubmittedTxSafely(
  text: string,
  walletAddress: `0x${string}`
): Promise<XLayerInboundTransfer | undefined> {
  const txHash = extractTxHash(text);
  if (!txHash) return undefined;
  return verifyXLayerInboundTransfer({
    txHash,
    walletAddress
  });
}

async function syncWalletAssetsSafely(
  wallet: ReturnType<typeof createAgentWalletContext>,
  memory?: Parameters<typeof syncAgentWalletContext>[1]
) {
  return syncAgentWalletContext(wallet, memory);
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
    const market = await getWorldCupCandidateMarket();
    if (market) return market;
  } catch {
    // Local/CI builds may not have the plugin installed; keep the Agent flow card-backed.
  }

  return pickBestOkxWorldCupMarket(normalizeOkxOutcomes(sampleOkxWorldCupPayload).markets);
}

function readCandidateMarket(input: unknown): MarketSnapshot | undefined {
  if (!input || typeof input !== "object") return undefined;
  const market = input as Partial<MarketSnapshot>;
  if (!market.marketId || !market.question || !market.provider || !market.chainId) return undefined;
  if (market.provider !== "okx-outcomes" && market.provider !== "polymarket-plugin") return undefined;
  if (market.chainId !== 137 && market.chainId !== 196) return undefined;
  return {
    provider: market.provider,
    chainId: market.chainId,
    eventId: market.eventId,
    marketId: market.marketId,
    question: market.question,
    status: market.status,
    marketType: market.marketType,
    yesAssetId: market.yesAssetId,
    noAssetId: market.noAssetId,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    acceptingOrders: Boolean(market.acceptingOrders),
    liquidity: market.liquidity,
    volume24h: market.volume24h,
    volume: market.volume,
    endDate: market.endDate,
    raw: market.raw
  };
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

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-owner-user-id"
  };
}
