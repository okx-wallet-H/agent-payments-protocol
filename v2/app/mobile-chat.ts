import type {
  BusinessGoalType,
  ConversationCard,
  ConversationTurn,
  MobileChatAction,
  MobileChatMessage,
  MobileChatTurn
} from "../domain/types";

export function createMobileChatTurn(turn: ConversationTurn): MobileChatTurn {
  const messages: MobileChatMessage[] = [
    {
      id: `${turn.id}:user`,
      role: "user" as const,
      kind: "text" as const,
      text: turn.goal.userText,
      createdAt: turn.goal.createdAt
    },
    ...turn.progress
      .filter((message) => message.visibility === "user")
      .map((message) => ({
        id: message.id,
        role: "agent" as const,
        kind: "progress" as const,
        text: message.text,
        createdAt: message.createdAt
    })),
    ...turn.cards.map((card) => ({
      id: getCardId(turn, card),
      role: "agent" as const,
      kind: "card" as const,
      card,
      actions: getCardActions(card),
      createdAt: getCardCreatedAt(turn, card)
    }))
  ];

  if (turn.finalText) {
    messages.push({
      id: `${turn.id}:final`,
      role: "agent",
      kind: "text",
      text: turn.finalText,
      createdAt: turn.createdAt
    });
  }

  return {
    type: "mobile_chat_turn",
    id: turn.id,
    goalType: turn.goal.type,
    messages,
    cards: turn.cards,
    suggestedInput: getSuggestedInput(turn),
    createdAt: turn.createdAt
  };
}

export function createMobileActionTurn(input: {
  userText: string;
  goalType: BusinessGoalType;
  progress: string[];
  card: ConversationCard;
  finalText: string;
  suggestedInput?: string;
}): MobileChatTurn {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const messages: MobileChatMessage[] = [
    {
      id: `${id}:user`,
      role: "user",
      kind: "text",
      text: input.userText,
      createdAt: now
    },
    ...input.progress.map((text, index) => ({
      id: `${id}:progress:${index}`,
      role: "agent" as const,
      kind: "progress" as const,
      text,
      createdAt: now
    })),
    {
      id: getCardIdFromCard(id, input.card),
      role: "agent",
      kind: "card",
      card: input.card,
      actions: getCardActions(input.card),
      createdAt: getCardCreatedAtFromCard(now, input.card)
    },
    {
      id: `${id}:final`,
      role: "agent",
      kind: "text",
      text: input.finalText,
      createdAt: now
    }
  ];

  return {
    type: "mobile_chat_turn",
    id,
    goalType: input.goalType,
    messages,
    cards: [input.card],
    suggestedInput: input.suggestedInput,
    createdAt: now
  };
}

function getCardActions(card: ConversationCard): MobileChatAction[] {
  if (card.type === "receive_card") {
    return [
      {
        id: "copy",
        label: "复制地址"
      }
    ];
  }

  if (card.type === "prediction_card") {
    return card.actions.map((action) => ({
      id: action,
      label: getPredictionActionLabel(action)
    }));
  }

  if (card.type === "strategy_card") {
    return [
      card.nextAction === "wait"
        ? {
            id: "track",
            label: "先盯着"
          }
        : {
            id: card.nextAction,
            label: card.nextAction === "simulate" ? "跑一次模拟" : "加入跟踪"
          }
    ];
  }

  return [];
}

function getCardId(turn: ConversationTurn, card: ConversationCard): string {
  if ("id" in card) return card.id;
  return `${turn.id}:receive-card`;
}

function getCardCreatedAt(turn: ConversationTurn, card: ConversationCard): string {
  if ("createdAt" in card) return card.createdAt;
  return turn.createdAt;
}

function getCardIdFromCard(prefix: string, card: ConversationCard): string {
  if ("id" in card) return card.id;
  return `${prefix}:card`;
}

function getCardCreatedAtFromCard(fallback: string, card: ConversationCard): string {
  if ("createdAt" in card) return card.createdAt;
  return fallback;
}

function getPredictionActionLabel(action: "simulate" | "track" | "build_strategy"): string {
  if (action === "simulate") return "先模拟";
  if (action === "track") return "加入跟踪";
  return "生成策略";
}

function getSuggestedInput(turn: ConversationTurn): string | undefined {
  if (turn.goal.type === "wallet_receive") return "帮我看看市场机会";
  if (turn.goal.type === "prediction_market_research") return "先模拟一下";
  return "我要充值";
}
