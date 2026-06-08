import type {
  V2ConversationCard,
  V2MarketSnapshot,
  V2MobileChatMessage,
  V2MobileChatTurn,
  V2MobileHomeView
} from "./types";

export interface V2AgentWalletApi {
  getV2Home(userId?: string, walletAddress?: `0x${string}`): Promise<V2MobileHomeView>;
  sendV2Chat(text: string, userId?: string, walletAddress?: `0x${string}`, candidateMarket?: V2MarketSnapshot): Promise<V2MobileChatTurn>;
  runV2Action(input: {
    action: "simulate" | "track" | "build_strategy";
    market: V2MarketSnapshot;
    amountUsd?: number;
    userId?: string;
    idempotencyKey?: string;
  }): Promise<V2MobileChatTurn>;
}

export interface V2AgentWalletSession {
  home?: V2MobileHomeView;
  messages: V2MobileChatMessage[];
  busy: boolean;
  error?: string;
  updatedAt?: string;
}

export const initialV2AgentWalletSession: V2AgentWalletSession = {
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
    const home = await api.getV2Home(userId, walletAddress);
    return {
      ...session,
      home,
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
    const turn = await api.sendV2Chat(text.trim(), userId, walletAddress, candidateMarket);
    return appendTurn(working, turn);
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
    return appendTurn(working, turn);
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
  if (card.type === "prediction_card" || card.type === "tracking_card" || card.type === "strategy_card") {
    return card.market;
  }
  return undefined;
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
    error: error instanceof Error ? error.message : "请求失败"
  };
}
