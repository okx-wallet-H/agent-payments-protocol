export type AgentStatus = "active" | "paused" | "revoked";

export type WalletType = "privy_embedded" | "aa_smart_account" | "eoa_vault" | "external";

export type IntentStatus =
  | "draft"
  | "approved"
  | "blocked"
  | "simulated"
  | "executed"
  | "failed";

export type TradeSide = "yes" | "no" | "buy" | "sell" | "hold";

export type ExecutionMode = "observe_only" | "simulate" | "mainnet_small";

export type MarketSource =
  | "okx_exchange_os"
  | "okx_observed"
  | "polymarket_plugin"
  | "xlayer_dex"
  | "manual";

export interface AgentToolRoute {
  router: "onchainos-plugin-router";
  skill: "polymarket-plugin" | "okx-onchainos";
  command: string;
  mode: "observe" | "preview" | "execute";
  chainId?: number;
}

export interface AgentPolicy {
  maxSingleSpendOkb: number;
  dailyBudgetOkb: number;
  dailyLossLimitOkb: number;
  allowedMarkets: string[];
  allowedTokens: string[];
  expiresAt: string;
  revoked: boolean;
}

export interface AgentVault {
  chainId: 196;
  chainName: "X Layer";
  address: `0x${string}`;
  displayAddress: string;
  walletType: WalletType;
  balanceSnapshotOkb: string;
  lastBalanceSyncAt: string;
}

export interface Agent {
  id: string;
  ownerUserId: string;
  name: string;
  status: AgentStatus;
  strategyProfile: string;
  executionMode: ExecutionMode;
  userWalletAddress?: `0x${string}`;
  vault?: AgentVault;
  policy: AgentPolicy;
  memory: AgentMemory;
  messages: AgentMessage[];
  runs: AgentRun[];
  intents: TradeIntent[];
  previews: ExecutionPreview[];
  executions: ExecutionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentMemory {
  userPreferences: string[];
  riskProfile: {
    maxComfortableTradeOkb?: number;
    requiresPreviewBeforeExecution: boolean;
    requiresTypedConfirmation: boolean;
    prefersSmallMainnetBudgets: boolean;
  };
  strategyHints: string[];
  recentLessons: string[];
  counters: {
    chatTurns: number;
    agentRuns: number;
    previewsCreated: number;
    confirmations: number;
    executions: number;
  };
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  action?: AgentChatAction;
  decision?: AgentDecision;
  toolResult?: Record<string, unknown>;
  createdAt: string;
}

export type AgentChatAction =
  | "help"
  | "memory"
  | "status"
  | "run_agent"
  | "confirm_preview"
  | "preview_intent"
  | "execute_intent"
  | "unsupported";

export interface AgentDecision {
  engine: "local-rules" | "llm";
  action: AgentChatAction;
  confidence: number;
  reasons: string[];
  toolCalls: AgentDecisionToolCall[];
  safetyNotes: string[];
}

export interface AgentDecisionToolCall {
  name:
    | "runPredictionAgent"
    | "createPreviewForIntent"
    | "confirmExecutionPreview"
    | "executeAgentIntent"
    | "summarizeAgentMemory"
    | "summarizeAgentStatus"
    | "explainCapabilities";
  arguments: Record<string, unknown>;
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: "completed" | "blocked" | "failed";
  goal: string;
  router: PredictionRouterInfo;
  observedMarketCount: number;
  selectedMarketId?: string;
  selectedQuestion?: string;
  selectionReason: string;
  intentId?: string;
  previewId?: string;
  riskNotes: string[];
  createdAt: string;
}

export interface TradeIntent {
  id: string;
  agentId: string;
  market: string;
  marketSource: MarketSource;
  side: TradeSide;
  amountOkb: number;
  confidence: number;
  expectedProbability: number;
  marketProbability?: number;
  externalMarketId?: string;
  externalMarketSlug?: string;
  externalQuestion?: string;
  pluginName?: string;
  toolRoute?: AgentToolRoute;
  executionPlan?: string[];
  liveModeRequired?: boolean;
  previewRequired?: boolean;
  reasoning: string;
  status: IntentStatus;
  riskNotes: string[];
  createdAt: string;
}

export interface ExecutionRecord {
  id: string;
  agentId: string;
  intentId: string;
  status: "simulated" | "executed" | "blocked" | "failed";
  txHash?: `0x${string}`;
  costOkb: number;
  error?: string;
  explorerUrl?: string;
  provider?: "okx" | "polymarket" | "simulator";
  createdAt: string;
}

export interface ExecutionPreview {
  id: string;
  agentId: string;
  intentId: string;
  provider: "okx" | "polymarket" | "simulator";
  mode: "paper" | "live";
  market: string;
  side: TradeSide;
  amountOkb: number;
  estimatedCostOkb: number;
  estimatedGasOkb: number;
  price?: number;
  toolRoute?: AgentToolRoute;
  warnings: string[];
  safetySummary: ExecutionSafetySummary;
  confirmationText?: string;
  confirmationCode?: string;
  confirmationStatus: "not_required" | "pending" | "confirmed" | "expired" | "locked";
  confirmationAttempts: number;
  maxConfirmationAttempts: number;
  confirmedAt?: string;
  confirmedBy?: string;
  expiresAt: string;
  createdAt: string;
}

export interface ExecutionSafetySummary {
  title: string;
  modeLabel: "安全演练" | "实盘";
  willMoveFunds: boolean;
  amountLabel: string;
  riskLevel: "low" | "medium" | "high";
  userChecklist: string[];
}

export interface PredictionMarket {
  id: string;
  provider: "polymarket";
  source?: "onchainos_plugin";
  pluginName?: "polymarket-plugin";
  question: string;
  slug: string;
  acceptingOrders: boolean;
  yesPrice: number;
  noPrice: number;
  lastTradePrice?: number;
  liquidity?: number;
  volume24hr?: number;
  endDate?: string;
}

export interface PredictionRouterInfo {
  name: "onchainos-plugin-router";
  mode: "paper" | "live";
  primarySkill: "polymarket-plugin";
  liveTradingEnabled: boolean;
  capabilities: string[];
  safetyGates: string[];
}

export interface AuditEvent {
  id: string;
  agentId: string;
  type:
    | "agent.created"
    | "vault.created"
    | "vault.balance.synced"
    | "policy.updated"
    | "agent.memory.updated"
    | "agent.chat.message"
    | "agent.run.completed"
    | "agent.run.failed"
    | "intent.created"
    | "intent.blocked"
    | "execution.previewed"
    | "execution.confirmed"
    | "execution.simulated"
    | "execution.executed"
    | "execution.failed"
    | "agent.paused"
    | "agent.revoked";
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Database {
  agents: Agent[];
  audit: AuditEvent[];
}
