import { createBusinessGoal, createPredictionResearchPlan } from "./business-agent";
import { createPredictionCard } from "./prediction-card";
import { createDefaultReceiveAddresses, createReceiveCard } from "./receive-card";
import { createProgressMessage, createRechargeProgress, createSelectedMarketProgress, createStrategyProgress } from "./progress-stream";
import type { BusinessGoalType, ConversationTurn, MarketSnapshot } from "../domain/types";

export function handlePhaseOneUserText(input: {
  userText: string;
  xLayerAddress?: `0x${string}`;
  polygonAddress?: `0x${string}`;
  candidateMarket?: MarketSnapshot;
  walletStatusText?: string;
  walletFundText?: string;
  walletTxText?: string;
  goalType?: BusinessGoalType;
}): ConversationTurn {
  const goal = createBusinessGoal(input.userText, input.goalType);

  if (goal.type === "wallet_receive") {
    if (!input.xLayerAddress) {
      return {
        id: crypto.randomUUID(),
        goal,
        progress: createRechargeProgress(goal),
        cards: [],
        finalText: "HWallet 正在生成，等地址出来我再给你收款入口。",
        createdAt: new Date().toISOString()
      };
    }

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
    const walletSyncPrefix = shouldIncludeWalletFundText(input.userText, input.walletFundText)
      ? `${input.walletFundText} `
      : "";
    const safetySuffix = shouldExplainNoLiveExecution(input.userText)
      ? " 这一步我只做分析和模拟，不会真实下单。"
      : "";
    const marketSnapshotText = plan.market ? createMarketSnapshotText(plan.market) : "";

    return {
      id: crypto.randomUUID(),
      goal,
      progress: input.candidateMarket ? createSelectedMarketProgress(goal) : createStrategyProgress(goal),
      cards: input.candidateMarket ? [createPredictionCard(input.candidateMarket)] : [],
      finalText: plan.market
        ? `${walletSyncPrefix}${marketSnapshotText}这场我先建议观察，点卡片可以继续跟踪或先模拟。${safetySuffix}`
        : `${walletSyncPrefix}我先去找世界杯相关市场。${safetySuffix}`,
      createdAt: new Date().toISOString()
    };
  }

  if (goal.type === "wallet_status") {
    return {
      id: crypto.randomUUID(),
      goal,
      progress: [
        createProgressMessage(goal, "我看一下 HWallet 状态。"),
        createProgressMessage(goal, "收款网络默认是 X Layer。")
      ],
      cards: [],
      finalText: input.walletStatusText || "HWallet 已经准备好。要充值，直接说我要充值。",
      createdAt: new Date().toISOString()
    };
  }

  if (goal.type === "agent_fund_prepare") {
    return {
      id: crypto.randomUUID(),
      goal,
      progress: [
        createProgressMessage(goal, "我刷新一下 HWallet。"),
        createProgressMessage(goal, "再看 X Layer 上的资金变化。")
      ],
      cards: [],
      finalText: input.walletFundText || "我还没看到新的到账记录。你可以稍后再刷新一次，或者直接说我要充值。",
      createdAt: new Date().toISOString()
    };
  }

  if (goal.type === "wallet_tx_verify") {
    return {
      id: crypto.randomUUID(),
      goal,
      progress: [
        createProgressMessage(goal, "我核对一下这笔交易。"),
        createProgressMessage(goal, "再确认收款地址是不是当前 HWallet。"),
        createProgressMessage(goal, "最后刷新可用资金。")
      ],
      cards: [],
      finalText: input.walletTxText || "我暂时没有查到这笔交易，等一下再试。",
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

function shouldIncludeWalletFundText(userText: string, walletFundText?: string): walletFundText is string {
  if (!walletFundText) return false;
  return /好了|充完|已充|已转|转了|到账|到了|到帐|刷新|钱包|HWallet|done|finished|arrived|refresh|wallet/i.test(userText);
}

function shouldExplainNoLiveExecution(userText: string): boolean {
  return /执行|下单|买|卖|execute|buy|sell/i.test(userText);
}

function createMarketSnapshotText(market: MarketSnapshot): string {
  const yesPercent = toDisplayPercent(market.yesPrice);
  const noPercent = toDisplayPercent(market.noPrice);
  if (yesPercent === undefined || noPercent === undefined) return "";
  return `当前快照：会 ${yesPercent}% / 不会 ${noPercent}%。`;
}

function toDisplayPercent(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.round(value * 10000) / 100;
}
