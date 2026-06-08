import { createBusinessGoal, createPredictionResearchPlan } from "./business-agent";
import { createPredictionCard } from "./prediction-card";
import { createDefaultReceiveAddresses, createReceiveCard } from "./receive-card";
import { createRechargeProgress, createSelectedMarketProgress, createStrategyProgress } from "./progress-stream";
import type { ConversationTurn, MarketSnapshot } from "../domain/types";

export function handlePhaseOneUserText(input: {
  userText: string;
  xLayerAddress: `0x${string}`;
  polygonAddress: `0x${string}`;
  candidateMarket?: MarketSnapshot;
}): ConversationTurn {
  const goal = createBusinessGoal(input.userText);

  if (goal.type === "wallet_receive") {
    const addresses = createDefaultReceiveAddresses({
      xLayerAddress: input.xLayerAddress,
      polygonAddress: input.polygonAddress
    });

    return {
      id: crypto.randomUUID(),
      goal,
      progress: createRechargeProgress(goal),
      cards: [createReceiveCard(addresses)],
      finalText: "地址给你了，复制后直接充值。",
      createdAt: new Date().toISOString()
    };
  }

  if (goal.type === "prediction_market_research") {
    const plan = createPredictionResearchPlan(goal, input.candidateMarket);

    return {
      id: crypto.randomUUID(),
      goal,
      progress: input.candidateMarket ? createSelectedMarketProgress(goal) : createStrategyProgress(goal),
      cards: input.candidateMarket ? [createPredictionCard(input.candidateMarket)] : [],
      finalText: plan.market ? "这场我先建议观察，点卡片可以继续跟踪或先模拟。" : "我先去找世界杯相关市场。",
      createdAt: new Date().toISOString()
    };
  }

  return {
    id: crypto.randomUUID(),
    goal,
    progress: [],
    cards: [],
    finalText: "你可以直接说：我要充值，或者帮我看看世界杯机会。",
    createdAt: new Date().toISOString()
  };
}
