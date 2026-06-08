export type AgentStatus = "active" | "paused" | "revoked";
export type IntentStatus = "draft" | "approved" | "blocked" | "simulated" | "executed" | "failed";
export type ExecutionMode = "observe_only" | "simulate" | "mainnet_small";
export type MarketSource = "okx_exchange_os" | "okx_observed" | "polymarket_plugin" | "xlayer_dex" | "manual";

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
  walletType: string;
  balanceSnapshotOkb: string;
  lastBalanceSyncAt: string;
}

export interface TradeIntent {
  id: string;
  agentId: string;
  market: string;
  marketSource: MarketSource;
  side: string;
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
  side: string;
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

export interface AuditEvent {
  id: string;
  agentId: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type V2BusinessGoalType =
  | "prediction_market_research"
  | "prediction_market_dry_run"
  | "prediction_market_execute"
  | "wallet_receive"
  | "agent_fund_prepare"
  | "wallet_status"
  | "unknown";

export interface V2MarketSnapshot {
  provider: "polymarket-plugin" | "okx-outcomes";
  chainId: 137 | 196;
  eventId?: string;
  marketId: string;
  question: string;
  status?: "active" | "paused" | "settling" | "resolved" | string;
  marketType?: "binary" | "neg_risk" | string;
  yesAssetId?: string;
  noAssetId?: string;
  yesPrice?: number;
  noPrice?: number;
  acceptingOrders: boolean;
  liquidity?: number;
  volume24h?: number;
  volume?: number;
  endDate?: string;
  raw?: unknown;
}

export interface V2ReceiveAddress {
  id: string;
  label: string;
  network: string;
  chainId: 137 | 196;
  address: `0x${string}`;
  supportedAssets: string[];
}

export interface V2ReceiveCard {
  type: "receive_card";
  title: string;
  addresses: V2ReceiveAddress[];
  primaryAction: "copy";
}

export interface V2PredictionCard {
  type: "prediction_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  market: V2MarketSnapshot;
  metrics: {
    probabilityLabel?: string;
    heatLabel?: string;
    priceLabel?: string;
  };
  suggestedAction: string;
  actions: Array<"simulate" | "track" | "build_strategy">;
  createdAt: string;
}

export interface V2SimulationCard {
  type: "simulation_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  amountLabel: string;
  sharesLabel?: string;
  priceLabel?: string;
  createdAt: string;
}

export interface V2TrackingCard {
  type: "tracking_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  watchText: string;
  market: V2MarketSnapshot;
  createdAt: string;
}

export interface V2StrategyCard {
  type: "strategy_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  steps: string[];
  riskText: string;
  nextAction: "simulate" | "track" | "wait";
  market: V2MarketSnapshot;
  createdAt: string;
}

export type V2ConversationCard =
  | V2ReceiveCard
  | V2PredictionCard
  | V2SimulationCard
  | V2TrackingCard
  | V2StrategyCard;

export interface V2MobileChatAction {
  id: "simulate" | "track" | "build_strategy" | "copy";
  label: string;
}

export interface V2MobileChatMessage {
  id: string;
  role: "user" | "agent";
  kind: "text" | "progress" | "card";
  text?: string;
  card?: V2ConversationCard;
  actions?: V2MobileChatAction[];
  createdAt: string;
}

export interface V2MobileChatTurn {
  type: "mobile_chat_turn";
  id: string;
  goalType: V2BusinessGoalType;
  messages: V2MobileChatMessage[];
  cards: V2ConversationCard[];
  suggestedInput?: string;
  createdAt: string;
}

export interface V2WorldCupInfoPanel {
  type: "world_cup_info_panel";
  title: string;
  summary: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    value?: string;
  }>;
  updatedAt: string;
}

export interface V2UserConsolePanel {
  type: "user_console_panel";
  title: string;
  walletLabel?: string;
  actions: Array<{
    id: "recharge" | "my_strategies" | "tracking" | "records" | "settings";
    label: string;
    caption: string;
  }>;
  updatedAt: string;
}

export interface V2MobileHomeView {
  type: "mobile_home_view";
  shell: {
    main: "premium_ai_conversation";
    entries: Array<{
      id: "world_cup_info" | "user_console";
      position: "top_left" | "top_right";
      label: string;
    }>;
  };
  panels: {
    topLeft: V2WorldCupInfoPanel;
    topRight: V2UserConsolePanel;
  };
  state: {
    trackingCount: number;
    strategyCount: number;
    recordCount: number;
  };
  quickPrompts: Array<{
    id: "world_cup" | "recharge" | "records";
    text: string;
  }>;
  recent: {
    tracking: V2TrackingCard[];
    strategies: V2StrategyCard[];
    records: Array<{
      id: string;
      type: string;
      title: string;
      note: string;
      createdAt: string;
    }>;
  };
  updatedAt: string;
}

export interface V2PhaseOneRecord {
  id: string;
  userId: string;
  idempotencyKey?: string;
  type: "tracking.saved" | "strategy.saved" | "simulation.saved";
  title: string;
  note: string;
  card: V2TrackingCard | V2StrategyCard | V2SimulationCard;
  createdAt: string;
}
