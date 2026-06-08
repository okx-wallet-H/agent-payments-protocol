export type ChainId = 137 | 196;

export type BusinessGoalType =
  | "prediction_market_research"
  | "prediction_market_dry_run"
  | "prediction_market_execute"
  | "wallet_receive"
  | "agent_fund_prepare"
  | "wallet_status"
  | "unknown";

export type ExecutionMode = "observe" | "dry_run" | "live";

export type ExecutionProvider = "onchainos" | "polymarket-plugin";

export type PolicyDecisionStatus = "allow" | "block" | "needs_user_confirmation";

export interface UserContext {
  userId: string;
  email?: string;
  activeWalletAddress?: `0x${string}`;
}

export interface AgentContext {
  agentId: string;
  ownerUserId: string;
  name: string;
  status: "active" | "paused" | "revoked";
}

export interface AgentWalletSecurity {
  signingModel: "tee";
  privateKeyLocation: "trusted_execution_environment";
  exportAllowedInChat: false;
}

export interface AgentPolicy {
  maxSingleTradeUsd: number;
  maxDailyTradeUsd: number;
  allowedProviders: ExecutionProvider[];
  allowedChains: ChainId[];
  allowedMarkets: string[];
  liveExecutionEnabled: boolean;
}

export interface BusinessGoal {
  id: string;
  userText: string;
  type: BusinessGoalType;
  createdAt: string;
}

export interface MarketSnapshot {
  provider: "polymarket-plugin";
  chainId: 137;
  marketId: string;
  question: string;
  yesPrice?: number;
  noPrice?: number;
  acceptingOrders: boolean;
  liquidity?: number;
  volume24h?: number;
  endDate?: string;
}

export interface ReceiveAddress {
  id: string;
  label: string;
  network: string;
  chainId: ChainId;
  address: `0x${string}`;
  supportedAssets: string[];
}

export interface ReceiveCard {
  type: "receive_card";
  title: string;
  addresses: ReceiveAddress[];
  primaryAction: "copy";
}

export interface InternalFundPreparation {
  id: string;
  sourceAddress: `0x${string}`;
  targetUse: "prediction_strategy";
  requiredNetwork: string;
  requiredAsset: string;
  requestedAmountUsd?: number;
  status: "planned" | "ready" | "needs_swap" | "needs_bridge" | "completed" | "failed";
  userVisible: false;
  createdAt: string;
}

export interface AgentProgressMessage {
  id: string;
  goalId: string;
  visibility: "user" | "detail";
  text: string;
  createdAt: string;
}

export interface PredictionCard {
  type: "prediction_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  market: MarketSnapshot;
  metrics: {
    probabilityLabel?: string;
    heatLabel?: string;
    priceLabel?: string;
  };
  suggestedAction: string;
  actions: Array<"simulate" | "track" | "build_strategy">;
  createdAt: string;
}

export interface SimulationCard {
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

export interface TrackingCard {
  type: "tracking_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  watchText: string;
  market: MarketSnapshot;
  createdAt: string;
}

export interface StrategyCard {
  type: "strategy_card";
  id: string;
  title: string;
  statusText: string;
  agentNote: string;
  steps: string[];
  riskText: string;
  nextAction: "simulate" | "track" | "wait";
  market: MarketSnapshot;
  createdAt: string;
}

export type ConversationCard = ReceiveCard | PredictionCard | SimulationCard | TrackingCard | StrategyCard;

export interface ConversationTurn {
  id: string;
  goal: BusinessGoal;
  progress: AgentProgressMessage[];
  cards: ConversationCard[];
  finalText?: string;
  createdAt: string;
}

export interface AppShellEntry {
  id: "world_cup_info" | "user_console";
  position: "top_left" | "top_right";
  label: string;
}

export interface PhaseOneAppShell {
  main: "premium_ai_conversation";
  entries: AppShellEntry[];
}

export interface WorldCupInfoItem {
  id: string;
  title: string;
  subtitle: string;
  value?: string;
}

export interface WorldCupInfoPanel {
  type: "world_cup_info_panel";
  title: string;
  summary: string;
  items: WorldCupInfoItem[];
  updatedAt: string;
}

export interface UserConsoleAction {
  id: "recharge" | "my_strategies" | "tracking" | "records" | "settings";
  label: string;
  caption: string;
}

export interface UserConsolePanel {
  type: "user_console_panel";
  title: string;
  walletLabel?: string;
  actions: UserConsoleAction[];
  updatedAt: string;
}

export interface MobileHomeQuickPrompt {
  id: "world_cup" | "recharge" | "records";
  text: string;
}

export interface MobileHomeStateSummary {
  trackingCount: number;
  strategyCount: number;
  recordCount: number;
}

export interface MobileHomeView {
  type: "mobile_home_view";
  shell: PhaseOneAppShell;
  panels: {
    topLeft: WorldCupInfoPanel;
    topRight: UserConsolePanel;
  };
  state: MobileHomeStateSummary;
  quickPrompts: MobileHomeQuickPrompt[];
  recent: {
    tracking: TrackingCard[];
    strategies: StrategyCard[];
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

export interface MobileChatAction {
  id: "simulate" | "track" | "build_strategy" | "copy";
  label: string;
}

export interface MobileChatMessage {
  id: string;
  role: "user" | "agent";
  kind: "text" | "progress" | "card";
  text?: string;
  card?: ConversationCard;
  actions?: MobileChatAction[];
  createdAt: string;
}

export interface MobileChatTurn {
  type: "mobile_chat_turn";
  id: string;
  goalType: BusinessGoalType;
  messages: MobileChatMessage[];
  cards: ConversationCard[];
  suggestedInput?: string;
  createdAt: string;
}

export interface BusinessPlan {
  id: string;
  goalId: string;
  mode: ExecutionMode;
  provider: ExecutionProvider;
  market?: MarketSnapshot;
  side?: "yes" | "no" | "up" | "down";
  amountUsd?: number;
  limitPrice?: number;
  summary: string;
  createdAt: string;
}

export interface PolicyDecision {
  status: PolicyDecisionStatus;
  reasons: string[];
  requiredConfirmationText?: string;
}

export interface ExecutionRequest {
  id: string;
  planId: string;
  mode: ExecutionMode;
  provider: ExecutionProvider;
  command: string;
  args: Record<string, string | number | boolean | undefined>;
  createdAt: string;
}

export interface ExecutionResult {
  requestId: string;
  status: "observed" | "dry_run_completed" | "submitted" | "blocked" | "failed";
  summary: string;
  txHash?: `0x${string}`;
  raw?: unknown;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  agentId: string;
  userId: string;
  type:
    | "goal.received"
    | "plan.created"
    | "policy.checked"
    | "execution.requested"
    | "execution.completed"
    | "execution.blocked";
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}
