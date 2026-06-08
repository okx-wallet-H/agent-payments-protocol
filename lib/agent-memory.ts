import type { Agent, AgentMemory, AgentMessage } from "./types";

export function createDefaultAgentMemory(): AgentMemory {
  return {
    userPreferences: [],
    riskProfile: {
      requiresPreviewBeforeExecution: true,
      requiresTypedConfirmation: true,
      prefersSmallMainnetBudgets: true
    },
    strategyHints: [
      "Prefer Onchain OS plugin routes before custom market infrastructure.",
      "Use paper or simulated execution unless live-mode gates are explicitly satisfied."
    ],
    recentLessons: [],
    counters: {
      chatTurns: 0,
      agentRuns: 0,
      previewsCreated: 0,
      confirmations: 0,
      executions: 0
    },
    updatedAt: new Date().toISOString()
  };
}

export function normalizeAgentMemory(memory?: Partial<AgentMemory>): AgentMemory {
  const defaults = createDefaultAgentMemory();
  return {
    userPreferences: memory?.userPreferences || defaults.userPreferences,
    riskProfile: {
      ...defaults.riskProfile,
      ...(memory?.riskProfile || {})
    },
    strategyHints: memory?.strategyHints || defaults.strategyHints,
    recentLessons: memory?.recentLessons || defaults.recentLessons,
    counters: {
      ...defaults.counters,
      ...(memory?.counters || {})
    },
    updatedAt: memory?.updatedAt || defaults.updatedAt
  };
}

export function updateAgentMemory(agent: Agent, userMessage: AgentMessage, assistantMessage: AgentMessage): AgentMemory {
  const memory = agent.memory || createDefaultAgentMemory();
  const content = userMessage.content.toLowerCase();
  const action = assistantMessage.action;
  const next: AgentMemory = {
    ...memory,
    userPreferences: [...memory.userPreferences],
    strategyHints: [...memory.strategyHints],
    recentLessons: [...memory.recentLessons],
    riskProfile: { ...memory.riskProfile },
    counters: {
      ...memory.counters,
      chatTurns: memory.counters.chatTurns + 1,
      agentRuns: memory.counters.agentRuns + (action === "run_agent" ? 1 : 0),
      previewsCreated: memory.counters.previewsCreated + (action === "preview_intent" || action === "run_agent" ? 1 : 0),
      confirmations: memory.counters.confirmations + (action === "confirm_preview" ? 1 : 0),
      executions: memory.counters.executions + (action === "execute_intent" ? 1 : 0)
    },
    updatedAt: new Date().toISOString()
  };

  rememberPreference(next, content);
  rememberRiskProfile(next, content);
  rememberStrategyHints(next, content, action);
  rememberLesson(next, userMessage, assistantMessage);

  return trimMemory(next);
}

export function summarizeAgentMemory(memory: AgentMemory): string {
  const amount = memory.riskProfile.maxComfortableTradeOkb
    ? `${memory.riskProfile.maxComfortableTradeOkb} OKB`
    : "not learned yet";

  return [
    "我目前记住了这些偏好和约束：",
    `- 你能接受的单次金额：${amount}`,
    `- 动手前是否必须先给方案：${memory.riskProfile.requiresPreviewBeforeExecution ? "是" : "否"}`,
    `- 是否必须明确确认：${memory.riskProfile.requiresTypedConfirmation ? "是" : "否"}`,
    `- 是否偏好小额尝试：${memory.riskProfile.prefersSmallMainnetBudgets ? "是" : "否"}`,
    `- 偏好：${memory.userPreferences.slice(-4).join(" / ") || "暂无明确偏好"}`,
    `- 策略提示：${memory.strategyHints.slice(-3).join(" / ") || "暂无"}`,
    `- 最近经验：${memory.recentLessons.slice(-2).join(" / ") || "暂无"}`
  ].join("\n");
}

function rememberPreference(memory: AgentMemory, content: string): void {
  if (/世界杯|world cup/.test(content)) addUnique(memory.userPreferences, "User is interested in World Cup prediction markets.");
  if (/polymarket/i.test(content)) addUnique(memory.userPreferences, "User accepts Polymarket plugin data as a prediction market source.");
  if (/manus|执行力|主动/.test(content)) addUnique(memory.userPreferences, "User wants a proactive Manus-like execution agent.");
  if (/解释|原因|why|reason/.test(content)) addUnique(memory.userPreferences, "User values explanations for tool calls and decisions.");
}

function rememberRiskProfile(memory: AgentMemory, content: string): void {
  const amount = parseAmountOkb(content);
  if (amount !== undefined) memory.riskProfile.maxComfortableTradeOkb = amount;
  if (/小额|small|保守|安全/.test(content)) memory.riskProfile.prefersSmallMainnetBudgets = true;
  if (/预览|preview/.test(content)) memory.riskProfile.requiresPreviewBeforeExecution = true;
  if (/确认|confirm/.test(content)) memory.riskProfile.requiresTypedConfirmation = true;
}

function rememberStrategyHints(memory: AgentMemory, content: string, action?: string): void {
  if (/onchain os|onchainos|插件|plugin/.test(content)) {
    addUnique(memory.strategyHints, "Route through Onchain OS plugins when a supported plugin exists.");
  }
  if (action === "execute_intent") {
    addUnique(memory.strategyHints, "Execution requests must stay policy gated and produce audit records.");
  }
}

function rememberLesson(memory: AgentMemory, userMessage: AgentMessage, assistantMessage: AgentMessage): void {
  const action = assistantMessage.action || "help";
  addUnique(memory.recentLessons, `When user said "${userMessage.content.slice(0, 80)}", Agent chose ${action}.`);
}

function trimMemory(memory: AgentMemory): AgentMemory {
  return {
    ...memory,
    userPreferences: memory.userPreferences.slice(-12),
    strategyHints: memory.strategyHints.slice(-12),
    recentLessons: memory.recentLessons.slice(-12)
  };
}

function addUnique(items: string[], value: string): void {
  if (!items.includes(value)) items.push(value);
}

function parseAmountOkb(value: string): number | undefined {
  const match = value.match(/(\d+(?:\.\d+)?)\s*okb/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}
