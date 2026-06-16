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
  | "wallet_tx_verify"
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
  startTime?: string;
  endDate?: string;
  raw?: unknown;
}

export type V2WorldCupExploreCategory = "champion" | "golden_boot" | "group_stage" | "upcoming_matches";

export interface V2WorldCupExploreOption {
  id: string;
  label: string;
  price?: number;
  priceLabel?: string;
  assetId?: string;
  side?: "yes" | "no";
}

export interface V2WorldCupExploreMarketCard {
  id: string;
  category: V2WorldCupExploreCategory;
  title: string;
  displayTitle: string;
  displayName: string;
  subtitle?: string;
  agentNote?: string;
  timing?: {
    status: "live" | "soon" | "today" | "upcoming" | "ended" | "unknown";
    label: string;
    startTime?: string;
  };
  probabilityLabel?: string;
  volumeLabel?: string;
  status: "observable" | "watch_only";
  market: V2MarketSnapshot;
  options: V2WorldCupExploreOption[];
}

export type V2WorldCupExploreSourceProvider = "okx-outcomes" | "polymarket-plugin" | "local-sample";

export interface V2WorldCupExploreSource {
  provider: V2WorldCupExploreSourceProvider;
  mode: "live" | "fallback" | "sample";
  label: string;
  message: string;
  updatedAt: string;
  warning?: string;
}

export interface V2WorldCupExploreView {
  type: "world_cup_explore_view";
  categories: Array<{
    id: V2WorldCupExploreCategory;
    label: string;
  }>;
  cards: Record<V2WorldCupExploreCategory, V2WorldCupExploreMarketCard[]>;
  summary: {
    totalMarkets: number;
    categoryCounts: Record<V2WorldCupExploreCategory, number>;
  };
  source: V2WorldCupExploreSource;
  updatedAt: string;
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
  marketTitle?: string;
  sideLabel?: string;
  amountLabel: string;
  sharesLabel?: string;
  priceLabel?: string;
  moneyMoved: false;
  market: V2MarketSnapshot;
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

export type V2AgentOrchestratorAction =
  | "show_receive_address"
  | "check_wallet_funds"
  | "verify_wallet_transaction"
  | "analyze_worldcup_market"
  | "simulate_prediction"
  | "hold";

export interface V2AgentPolicyDecision {
  status: "allow" | "block";
  action: "analyze" | "track" | "build_strategy" | "simulate" | "execute";
  reason: string;
  userText: string;
  policy: {
    id: string;
    mode: "mvp_observe_only";
    allowedActions: Array<"analyze" | "track" | "build_strategy" | "simulate" | "execute">;
    liveExecutionEnabled: false;
    maxSimulationUsd: number;
    allowedProviders: Array<"polymarket-plugin" | "okx-outcomes">;
    allowedChains: Array<137 | 196>;
    policyText: string;
  };
}

export interface V2AgentCapabilityGate {
  walletReady: boolean;
  fundsReady: boolean;
  needsWallet: boolean;
  needsFunds: boolean;
  onchainSkill: {
    status: "allowed" | "blocked" | "not_needed";
    mode: "none" | "observe" | "dry_run";
    capability: "none" | "okx-onchainos-skills";
    reason: string;
    serviceId?: "hwallet-core" | "okx-onchainos-skills" | "okx-outcomes" | "polymarket-plugin";
    serviceKind?: "internal" | "mcp_skill" | "api" | "plugin";
    serviceLabel?: string;
    route?: string;
    safety?: "no_external_call" | "read_only" | "dry_run_only";
  };
  liveExecution: {
    enabled: false;
    reason: string;
  };
  policyDecision?: V2AgentPolicyDecision;
}

export interface V2AgentOrchestration {
  action: V2AgentOrchestratorAction;
  goalType: V2BusinessGoalType;
  progressHint: string;
  capability: V2AgentCapabilityGate;
}

export interface V2AgentCapabilityExecutionResult {
  requestId: string;
  serviceId: "hwallet-core" | "okx-onchainos-skills" | "okx-outcomes" | "polymarket-plugin";
  serviceKind: "internal" | "mcp_skill" | "api" | "plugin";
  serviceLabel: string;
  route: string;
  mode: "none" | "observe" | "dry_run";
  safety: "no_external_call" | "read_only" | "dry_run_only";
  contractId?: string;
  toolName?: string;
  externalCallEnabled: false;
  externalCallAttempted: false;
  adapterStatus?: "not_required" | "disabled" | "blocked" | "ready" | "failed";
  status: "skipped" | "observed" | "dry_run_completed" | "blocked" | "failed";
  summary: string;
  moneyMoved: false;
  liveExecutionEnabled: false;
  mcpCallStatus: "not_called" | "mocked";
  payload: Record<string, unknown>;
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

export interface V2WalletContext {
  userId: string;
  address: `0x${string}`;
  chainId: 196;
  network: "X Layer";
  assets: Array<{
    symbol: "USDT0" | "USDT" | "OKB";
    name: string;
    amountLabel: string;
    amountValue?: string;
    valueLabel: string;
    syncStatus: "pending" | "synced" | "failed";
  }>;
  recentRecords: Array<{
    id: string;
    title: string;
    note: string;
    status: "pending" | "synced" | "failed";
    createdAt: string;
  }>;
  status: "ready" | "demo_fallback";
  statusText: string;
  lifecycle?: Array<{
    id: "identity" | "wallet" | "assets" | "agent";
    title: string;
    status: "done" | "active" | "waiting" | "failed";
    note: string;
  }>;
  agent: {
    mode: "observe_only";
    fundsStatus: "ready" | "waiting" | "sync_failed";
    availableText: string;
    primaryAsset?: "USDT0" | "USDT" | "OKB";
    nextActionText: string;
  };
  vault: {
    id: string;
    title: "Agent 资金池";
    status: "ready" | "waiting" | "sync_failed";
    displayText: string;
    policyText: string;
    sourceText: string;
    userVisibleAddress: false;
  };
  policy: {
    id: string;
    mode: "mvp_observe_only";
    allowedActions: Array<"analyze" | "track" | "build_strategy" | "simulate" | "execute">;
    liveExecutionEnabled: false;
    maxSimulationUsd: number;
    allowedProviders: Array<"polymarket-plugin" | "okx-outcomes">;
    allowedChains: Array<137 | 196>;
    policyText: string;
  };
}

export interface V2MobileAgentMemory {
  type: "mobile_agent_memory";
  userId: string;
  source: "session_memory_v1";
  counters: {
    homeLoads: number;
    chatTurns: number;
  };
  wallet?: {
    address?: `0x${string}`;
    chainId: 196;
    network: "X Layer";
    assetSnapshot?: {
      USDT0?: string;
      USDT?: string;
      OKB?: string;
    };
    records: V2WalletContext["recentRecords"];
    verifiedTransfers: Array<{
      txHash: `0x${string}`;
      status: "received" | "not_for_wallet" | "failed" | "not_found" | "unsupported_asset";
      message: string;
      explorerUrl?: string;
      chainId: 196;
      assetSymbol?: "USDT0" | "USDT" | "OKB";
      amountLabel?: string;
      tokenAddress?: `0x${string}`;
      verifiedAt: string;
    }>;
  };
  recentMessages: Array<{
    role: "user" | "agent";
    text: string;
    createdAt: string;
  }>;
  knowledgeNotes: string[];
  updatedAt?: string;
}

export interface V2AuditTimelineEvent {
  id: string;
  userId: string;
  type:
    | "wallet.refresh"
    | "wallet.tx_verified"
    | "device.evidence"
    | "prediction.analyzed"
    | "tracking.saved"
    | "strategy.saved"
    | "simulation.completed"
    | "policy.blocked";
  title: string;
  note: string;
  status: "success" | "blocked" | "info";
  moneyMoved: false;
  marketId?: string;
  marketTitle?: string;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  chainId?: number;
  assetSymbol?: string;
  amountLabel?: string;
  tokenAddress?: `0x${string}`;
  simulationSide?: string;
  simulationShares?: string;
  simulationPrice?: string;
  recordId?: string;
  walletRecordId?: string;
  walletRecord?: V2WalletContext["recentRecords"][number];
  card?: V2PredictionCard | V2TrackingCard | V2StrategyCard | V2SimulationCard;
  createdAt: string;
}

export interface V2MobileHomeResponse {
  home: V2MobileHomeView;
  wallet?: V2WalletContext;
}

export interface V2PhaseOneRecord {
  id: string;
  userId: string;
  idempotencyKey?: string;
  type: "prediction.saved" | "tracking.saved" | "strategy.saved" | "simulation.saved";
  title: string;
  note: string;
  card: V2PredictionCard | V2TrackingCard | V2StrategyCard | V2SimulationCard;
  createdAt: string;
}

export interface V2MobileDeviceEvidenceInput {
  userId?: string;
  walletAddress?: `0x${string}`;
  environment: {
    platform: string;
    buildChannel: string;
    apiBaseUrl: string;
    appVersion: string;
    buildNumber: string;
  };
  checks: {
    appOpensWithoutCrash: boolean;
    hWalletVisible: boolean;
    receiveAddressVisible: boolean;
    copyFeedbackVisible: boolean;
    noWrongUserDataExposure: boolean;
    liveExecutionClosed: boolean;
  };
  artifacts?: Array<{
    label: string;
    redacted: true;
  }>;
}

export interface V2MobileDeviceEvidenceResponse {
  ok: true;
  evidence: {
    id: string;
    userId: string;
    title: string;
    createdAt: string;
    redacted: true;
    walletAddress?: string;
    environment: V2MobileDeviceEvidenceInput["environment"];
    checks: V2MobileDeviceEvidenceInput["checks"];
    artifacts: NonNullable<V2MobileDeviceEvidenceInput["artifacts"]>;
  };
}
