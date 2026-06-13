import type {
  V2AuditTimelineEvent,
  V2AgentOrchestration,
  V2ConversationCard,
  V2MarketSnapshot,
  V2MobileAgentMemory,
  V2MobileChatMessage,
  V2MobileHomeResponse,
  V2MobileChatTurn,
  V2MobileHomeView,
  V2WalletContext
} from "./types";

export interface V2AgentWalletApi {
  getV2Home(userId?: string, walletAddress?: `0x${string}`): Promise<V2MobileHomeResponse>;
  getV2Wallet(userId?: string, walletAddress?: `0x${string}`): Promise<V2WalletContext>;
  getV2Memory(userId?: string): Promise<V2MobileAgentMemory>;
  refreshV2Wallet(userId?: string, walletAddress?: `0x${string}`): Promise<{ wallet: V2WalletContext; mobileTurn: V2MobileChatTurn }>;
  verifyV2WalletTx(txHash: string, userId?: string, walletAddress?: `0x${string}`): Promise<{ wallet: V2WalletContext; mobileTurn: V2MobileChatTurn }>;
  sendV2Chat(text: string, userId?: string, walletAddress?: `0x${string}`, candidateMarket?: V2MarketSnapshot): Promise<{
    mobileTurn: V2MobileChatTurn;
    wallet?: V2WalletContext;
    orchestration?: V2AgentOrchestration;
  }>;
  runV2Action(input: {
    action: "simulate" | "track" | "build_strategy";
    market: V2MarketSnapshot;
    amountUsd?: number;
    userId?: string;
    idempotencyKey?: string;
  }): Promise<V2MobileChatTurn>;
  listV2Audit(userId?: string): Promise<V2AuditTimelineEvent[]>;
}

export async function loadV2AgentWalletState(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  userId?: string,
  walletAddress?: `0x${string}`
): Promise<V2AgentWalletSession> {
  try {
    const wallet = await api.getV2Wallet(userId, walletAddress);
    return {
      ...session,
      wallet,
      error: undefined,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    return withSessionError(session, error);
  }
}

export async function refreshV2AgentWallet(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  userId?: string,
  walletAddress?: `0x${string}`
): Promise<V2AgentWalletSession> {
  const working = {
    ...session,
    busy: true,
    error: undefined
  };

  try {
    const response = await api.refreshV2Wallet(userId, walletAddress);
    const [audit, memory] = await Promise.all([
      api.listV2Audit(userId).catch(() => session.audit),
      api.getV2Memory(userId).catch(() => session.memory)
    ]);
    return {
      ...appendTurn(working, response.mobileTurn),
      wallet: response.wallet,
      memory,
      audit
    };
  } catch (error) {
    return withSessionError(working, error);
  }
}

export async function verifyV2AgentWalletTx(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  txHash: string,
  userId?: string,
  walletAddress?: `0x${string}`
): Promise<V2AgentWalletSession> {
  const working = {
    ...session,
    busy: true,
    error: undefined
  };

  try {
    const response = await api.verifyV2WalletTx(txHash, userId, walletAddress);
    const [audit, memory] = await Promise.all([
      api.listV2Audit(userId).catch(() => session.audit),
      api.getV2Memory(userId).catch(() => session.memory)
    ]);
    return {
      ...appendTurn(working, response.mobileTurn),
      wallet: response.wallet,
      memory,
      audit
    };
  } catch (error) {
    return withSessionError(working, error);
  }
}

export interface V2AgentWalletSession {
  home?: V2MobileHomeView;
  wallet?: V2WalletContext;
  memory?: V2MobileAgentMemory;
  orchestration?: V2AgentOrchestration;
  audit: V2AuditTimelineEvent[];
  messages: V2MobileChatMessage[];
  busy: boolean;
  error?: string;
  updatedAt?: string;
}

export const initialV2AgentWalletSession: V2AgentWalletSession = {
  audit: [],
  messages: [],
  busy: false
};

export async function loadV2AgentWalletHome(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  userId?: string,
  walletAddress?: `0x${string}`
): Promise<V2AgentWalletSession> {
  try {
    const [response, audit, memory] = await Promise.all([
      api.getV2Home(userId, walletAddress),
      api.listV2Audit(userId).catch(() => [] as V2AuditTimelineEvent[]),
      api.getV2Memory(userId).catch(() => undefined)
    ]);
    return {
      ...session,
      home: response.home,
      wallet: response.wallet,
      memory,
      audit,
      error: undefined,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    return withSessionError(session, error);
  }
}

export async function sendV2AgentWalletText(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  text: string,
  userId?: string,
  walletAddress?: `0x${string}`,
  candidateMarket?: V2MarketSnapshot
): Promise<V2AgentWalletSession> {
  if (!text.trim()) return session;

  const working = {
    ...session,
    busy: true,
    error: undefined
  };

  try {
    const response = await api.sendV2Chat(text.trim(), userId, walletAddress, candidateMarket);
    const turn = response.mobileTurn;
    const [audit, memory, wallet] = await Promise.all([
      api.listV2Audit(userId).catch(() => session.audit),
      api.getV2Memory(userId).catch(() => session.memory),
      response.wallet
        ? Promise.resolve(response.wallet)
        : isWalletGoal(turn.goalType)
          ? Promise.resolve(api.getV2Wallet(userId, walletAddress).catch(() => session.wallet))
        : Promise.resolve(session.wallet)
    ]);
    return {
      ...appendTurn(working, turn),
      wallet,
      memory,
      orchestration: response.orchestration || session.orchestration,
      audit
    };
  } catch (error) {
    return withSessionError(working, error);
  }
}

export async function runV2AgentWalletAction(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  input: {
    action: "simulate" | "track" | "build_strategy";
    market: V2MarketSnapshot;
    amountUsd?: number;
    userId?: string;
    idempotencyKey?: string;
  }
): Promise<V2AgentWalletSession> {
  const working = {
    ...session,
    busy: true,
    error: undefined
  };

  try {
    const turn = await api.runV2Action({
      ...input,
      idempotencyKey: input.idempotencyKey || createV2ActionIdempotencyKey(input)
    });
    const [audit, homeResponse, memory] = await Promise.all([
      api.listV2Audit(input.userId).catch(() => session.audit),
      api.getV2Home(input.userId, session.wallet?.address).catch(() => undefined),
      api.getV2Memory(input.userId).catch(() => session.memory)
    ]);
    return {
      ...appendTurn(working, turn),
      home: homeResponse?.home || session.home,
      wallet: homeResponse?.wallet || session.wallet,
      memory,
      audit
    };
  } catch (error) {
    return withSessionError(working, error);
  }
}

export async function runV2AgentWalletCardAction(
  api: V2AgentWalletApi,
  session: V2AgentWalletSession,
  input: {
    action: "simulate" | "track" | "build_strategy";
    card: V2ConversationCard;
    amountUsd?: number;
    userId?: string;
    idempotencyKey?: string;
  }
): Promise<V2AgentWalletSession> {
  const market = getPrimaryMarketFromCard(input.card);
  if (!market) {
    return withSessionError(session, new Error("这个卡片暂时没有可执行的市场。"));
  }

  return runV2AgentWalletAction(api, session, {
    action: input.action,
    market,
    amountUsd: input.amountUsd,
    userId: input.userId,
    idempotencyKey:
      input.idempotencyKey ||
      createV2ActionIdempotencyKey({
        action: input.action,
        market,
        amountUsd: input.amountUsd,
        userId: input.userId
      })
  });
}

export function openV2AgentWalletCard(
  session: V2AgentWalletSession,
  card: V2ConversationCard
): V2AgentWalletSession {
  const now = new Date().toISOString();
  const id = "id" in card ? card.id : `card-${now}`;
  return {
    ...session,
    busy: false,
    error: undefined,
    messages: [
      ...session.messages,
      {
        id: `open-card:${id}:${now}`,
        role: "agent",
        kind: "card",
        card,
        createdAt: now
      }
    ],
    updatedAt: now
  };
}

export function createV2ActionIdempotencyKey(input: {
  action: "simulate" | "track" | "build_strategy";
  market: V2MarketSnapshot;
  amountUsd?: number;
  userId?: string;
}): string {
  const amountPart = input.amountUsd === undefined ? "default" : input.amountUsd.toFixed(4);
  return [
    "v2-action",
    input.userId || "current-user",
    input.action,
    input.market.marketId,
    amountPart
  ]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export function getLatestV2Card(session: V2AgentWalletSession): V2ConversationCard | undefined {
  return session.messages
    .slice()
    .reverse()
    .find((message) => message.kind === "card" && message.card)?.card;
}

export function getPrimaryMarketFromCard(card: V2ConversationCard): V2MarketSnapshot | undefined {
  if (card.type === "prediction_card" || card.type === "tracking_card" || card.type === "strategy_card" || card.type === "simulation_card") {
    return card.market;
  }
  return undefined;
}

function isWalletGoal(goalType: V2MobileChatTurn["goalType"]): boolean {
  return goalType === "wallet_receive" ||
    goalType === "wallet_status" ||
    goalType === "wallet_tx_verify" ||
    goalType === "agent_fund_prepare";
}

function appendTurn(session: V2AgentWalletSession, turn: V2MobileChatTurn): V2AgentWalletSession {
  return {
    ...session,
    busy: false,
    error: undefined,
    messages: [...session.messages, ...turn.messages],
    updatedAt: turn.createdAt
  };
}

function withSessionError(session: V2AgentWalletSession, error: unknown): V2AgentWalletSession {
  return {
    ...session,
    busy: false,
    error: createFriendlySessionError(error)
  };
}

function createFriendlySessionError(error: unknown): string {
  if (isApiErrorCode(error, "wallet_address_conflict")) {
    return "这个账号已经绑定了 HWallet。请使用当前账号的钱包，或切换账号后再试。";
  }

  if (isApiErrorCode(error, "wallet_address_required")) {
    return "请先生成或绑定 HWallet，再检查这笔交易。";
  }

  if (error instanceof Error) return error.message;
  return "请求失败";
}

function isApiErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code
  );
}
