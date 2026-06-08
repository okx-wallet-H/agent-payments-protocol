import {
  getLatestV2Card,
  initialV2AgentWalletSession,
  runV2AgentWalletCardAction,
  sendV2AgentWalletText
} from "./v2-session";
import type { V2MarketSnapshot, V2MobileChatTurn } from "./types";

const predictionTurn: V2MobileChatTurn = {
  type: "mobile_chat_turn",
  id: "turn-1",
  goalType: "prediction_market_research",
  createdAt: "2026-06-08T00:00:00.000Z",
  suggestedInput: "先模拟一下",
  cards: [
    {
      type: "prediction_card",
      id: "card-1",
      title: "Will example win?",
      statusText: "可以继续看",
      agentNote: "先模拟。",
      market: {
        provider: "polymarket-plugin",
        chainId: 137,
        marketId: "market-1",
        question: "Will example win?",
        acceptingOrders: true,
        yesPrice: 0.1
      },
      metrics: {},
      suggestedAction: "先模拟",
      actions: ["simulate", "track", "build_strategy"],
      createdAt: "2026-06-08T00:00:00.000Z"
    }
  ],
  messages: [
    {
      id: "m1",
      role: "user",
      kind: "text",
      text: "世界杯预测",
      createdAt: "2026-06-08T00:00:00.000Z"
    },
    {
      id: "m2",
      role: "agent",
      kind: "card",
      card: {
        type: "prediction_card",
        id: "card-1",
        title: "Will example win?",
        statusText: "可以继续看",
        agentNote: "先模拟。",
        market: {
          provider: "polymarket-plugin",
          chainId: 137,
          marketId: "market-1",
          question: "Will example win?",
          acceptingOrders: true,
          yesPrice: 0.1
        },
        metrics: {},
        suggestedAction: "先模拟",
        actions: ["simulate", "track", "build_strategy"],
        createdAt: "2026-06-08T00:00:00.000Z"
      },
      actions: [{ id: "simulate", label: "先模拟" }],
      createdAt: "2026-06-08T00:00:00.000Z"
    }
  ]
};

const actionTurn: V2MobileChatTurn = {
  type: "mobile_chat_turn",
  id: "turn-2",
  goalType: "prediction_market_dry_run",
  createdAt: "2026-06-08T00:01:00.000Z",
  cards: [],
  messages: [
    {
      id: "m3",
      role: "agent",
      kind: "text",
      text: "模拟完成，可以继续观察。",
      createdAt: "2026-06-08T00:01:00.000Z"
    }
  ]
};

let receivedCandidateMarketId: string | undefined;

const api = {
  getV2Home: async () => {
    throw new Error("Not used in this smoke test.");
  },
  sendV2Chat: async (_text: string, _userId?: string, _walletAddress?: `0x${string}`, candidateMarket?: V2MarketSnapshot) => {
    receivedCandidateMarketId = candidateMarket?.marketId;
    return predictionTurn;
  },
  runV2Action: async (input: { idempotencyKey?: string }) => {
    if (!input.idempotencyKey) throw new Error("Expected idempotency key.");
    return actionTurn;
  }
};

async function main() {
  const selectedMarket = {
    provider: "okx-outcomes" as const,
    chainId: 196 as const,
    marketId: "selected-world-cup-market",
    question: "Will Spain win the 2026 FIFA World Cup?",
    acceptingOrders: true,
    yesPrice: 0.17
  };
  const afterChat = await sendV2AgentWalletText(
    api,
    initialV2AgentWalletSession,
    "帮我继续分析：西班牙会赢得 2026 年世界杯冠军吗？",
    "demo-user",
    undefined,
    selectedMarket
  );
  const latestCard = getLatestV2Card(afterChat);
  if (!latestCard) throw new Error("Expected latest card.");
  if (receivedCandidateMarketId !== selectedMarket.marketId) throw new Error("Expected selected market to be passed to chat API.");

  const afterAction = await runV2AgentWalletCardAction(api, afterChat, {
    action: "simulate",
    card: latestCard,
    userId: "demo-user"
  });

  console.log(JSON.stringify({
    chatMessages: afterChat.messages.length,
    finalMessages: afterAction.messages.length,
    latestCardType: latestCard.type,
    receivedCandidateMarketId,
    error: afterAction.error
  }, null, 2));
}

main().catch((error) => {
  throw error;
});
