import type { AgentProgressMessage, BusinessGoal } from "../domain/types";

export function createProgressMessage(goal: BusinessGoal, text: string, visibility: "user" | "detail" = "user"): AgentProgressMessage {
  return {
    id: crypto.randomUUID(),
    goalId: goal.id,
    visibility,
    text,
    createdAt: new Date().toISOString()
  };
}

export function createRechargeProgress(goal: BusinessGoal): AgentProgressMessage[] {
  return [
    createProgressMessage(goal, "我给你准备充值地址。"),
    createProgressMessage(goal, "复制地址后直接充值就行。"),
    createProgressMessage(goal, "到账后告诉我，我继续帮你处理后面的策略。")
  ];
}

export function createStrategyProgress(goal: BusinessGoal): AgentProgressMessage[] {
  return [
    createProgressMessage(goal, "我先看一下可用资金。"),
    createProgressMessage(goal, "正在整理世界杯相关市场。"),
    createProgressMessage(goal, "我会先筛成交活跃的方向。"),
    createProgressMessage(goal, "准备生成一份策略。")
  ];
}

export function createSelectedMarketProgress(goal: BusinessGoal): AgentProgressMessage[] {
  return [
    createProgressMessage(goal, "我先看这场的价格和热度。"),
    createProgressMessage(goal, "再对比一下市场现在偏向哪边。"),
    createProgressMessage(goal, "先给你一个能看懂的观察结论。")
  ];
}

export function createInternalFundProgress(goal: BusinessGoal): AgentProgressMessage[] {
  return [
    createProgressMessage(goal, "我在帮你准备策略资金。"),
    createProgressMessage(goal, "资金准备好后，我会继续跑策略。")
  ];
}
