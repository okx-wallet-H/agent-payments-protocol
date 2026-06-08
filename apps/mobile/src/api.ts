import type {
  Agent,
  AgentMessage,
  AgentRun,
  AuditEvent,
  ExecutionPreview,
  ExecutionRecord,
  PredictionMarket,
  PredictionRouterInfo,
  TradeIntent,
  V2MarketSnapshot,
  V2MobileChatTurn,
  V2MobileHomeView,
  V2PhaseOneRecord,
  V2StrategyCard,
  V2TrackingCard
} from "./types";

export interface ApiClient {
  listAgents(ownerUserId?: string): Promise<Agent[]>;
  createAgent(name: string, ownerUserId?: string, userWalletAddress?: string): Promise<Agent>;
  createVault(agentId: string, address?: string): Promise<Agent>;
  syncVault(agentId: string): Promise<Agent>;
  updatePolicy(agentId: string, maxSingleSpendOkb: number, dailyBudgetOkb: number): Promise<Agent>;
  sendMessage(agentId: string, content: string, userId?: string): Promise<AgentMessage[]>;
  runAgent(agentId: string, amountOkb: number, keyword?: string): Promise<AgentRun>;
  createIntent(agentId: string, amountOkb: number, market?: PredictionMarket): Promise<TradeIntent>;
  previewIntent(agentId: string, intentId?: string): Promise<ExecutionPreview>;
  confirmPreview(agentId: string, previewId: string, confirmationText: string, confirmedBy?: string): Promise<ExecutionPreview>;
  executeIntent(agentId: string, intentId?: string, previewId?: string): Promise<ExecutionRecord>;
  updateStatus(agentId: string, status: "active" | "paused" | "revoked"): Promise<Agent>;
  listAudit(agentId: string): Promise<AuditEvent[]>;
  listPredictionMarkets(keyword?: string): Promise<{ router?: PredictionRouterInfo; markets: PredictionMarket[] }>;
  getV2Home(userId?: string, walletAddress?: `0x${string}`): Promise<V2MobileHomeView>;
  sendV2Chat(text: string, userId?: string, walletAddress?: `0x${string}`): Promise<V2MobileChatTurn>;
  runV2Action(input: {
    action: "simulate" | "track" | "build_strategy";
    market: V2MarketSnapshot;
    amountUsd?: number;
    userId?: string;
    idempotencyKey?: string;
  }): Promise<V2MobileChatTurn>;
  listV2Tracking(userId?: string): Promise<V2TrackingCard[]>;
  listV2Strategies(userId?: string): Promise<V2StrategyCard[]>;
  listV2Records(userId?: string): Promise<V2PhaseOneRecord[]>;
}

type GetAccessToken = () => Promise<string | null | undefined>;

async function request<T>(baseUrl: string, path: string, init?: RequestInit, getAccessToken?: GetAccessToken): Promise<T> {
  const accessToken = await getAccessToken?.();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {})
    }
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `${response.status} ${path}`);
  return data;
}

export function createApi(baseUrl: string, getAccessToken?: GetAccessToken): ApiClient {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    async listAgents(ownerUserId) {
      const params = ownerUserId ? `?ownerUserId=${encodeURIComponent(ownerUserId)}` : "";
      const data = await request<{ agents: Agent[] }>(cleanBaseUrl, `/api/agents${params}`, undefined, getAccessToken);
      return data.agents;
    },
    async createAgent(name, ownerUserId, userWalletAddress) {
      const data = await request<{ agent: Agent }>(cleanBaseUrl, "/api/agents", {
        method: "POST",
        body: JSON.stringify({ ownerUserId, name, executionMode: "mainnet_small", userWalletAddress })
      }, getAccessToken);
      return data.agent;
    },
    async createVault(agentId, address) {
      const data = await request<{ agent: Agent }>(cleanBaseUrl, `/api/agents/${agentId}/vault`, {
        method: "POST",
        body: JSON.stringify({ address: address || undefined, walletType: "aa_smart_account" })
      }, getAccessToken);
      return data.agent;
    },
    async syncVault(agentId) {
      const data = await request<{ agent: Agent }>(cleanBaseUrl, `/api/agents/${agentId}/vault/sync`, {
        method: "POST"
      }, getAccessToken);
      return data.agent;
    },
    async updatePolicy(agentId, maxSingleSpendOkb, dailyBudgetOkb) {
      const data = await request<{ agent: Agent }>(cleanBaseUrl, `/api/agents/${agentId}/policy`, {
        method: "POST",
        body: JSON.stringify({ maxSingleSpendOkb, dailyBudgetOkb })
      }, getAccessToken);
      return data.agent;
    },
    async sendMessage(agentId, content, userId) {
      const data = await request<{ messages: AgentMessage[] }>(cleanBaseUrl, `/api/agents/${agentId}/chat`, {
        method: "POST",
        body: JSON.stringify({ content, userId })
      }, getAccessToken);
      return data.messages;
    },
    async runAgent(agentId, amountOkb, keyword = "World Cup") {
      const data = await request<{ run: AgentRun }>(cleanBaseUrl, `/api/agents/${agentId}/run`, {
        method: "POST",
        body: JSON.stringify({ amountOkb, keyword })
      }, getAccessToken);
      return data.run;
    },
    async createIntent(agentId, amountOkb, market) {
      const data = await request<{ intent: TradeIntent }>(cleanBaseUrl, `/api/agents/${agentId}/intents`, {
        method: "POST",
        body: JSON.stringify(
          market
            ? {
                market: "polymarket-world-cup-2026",
                provider: "onchainos_plugin",
                side: "yes",
                amountOkb,
                externalMarketId: market.id,
                externalMarketSlug: market.slug,
                externalQuestion: market.question,
                marketProbability: market.yesPrice,
                yesPrice: market.yesPrice
              }
            : { market: "okx-world-cup-2026", side: "yes", amountOkb }
        )
      }, getAccessToken);
      return data.intent;
    },
    async executeIntent(agentId, intentId, previewId) {
      const data = await request<{ execution: ExecutionRecord }>(cleanBaseUrl, `/api/agents/${agentId}/execute`, {
        method: "POST",
        body: JSON.stringify({ intentId, previewId })
      }, getAccessToken);
      return data.execution;
    },
    async previewIntent(agentId, intentId) {
      const data = await request<{ preview: ExecutionPreview }>(cleanBaseUrl, `/api/agents/${agentId}/preview`, {
        method: "POST",
        body: JSON.stringify({ intentId })
      }, getAccessToken);
      return data.preview;
    },
    async confirmPreview(agentId, previewId, confirmationText, confirmedBy) {
      const data = await request<{ preview: ExecutionPreview }>(
        cleanBaseUrl,
        `/api/agents/${agentId}/preview/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ previewId, confirmationText, confirmedBy })
        },
        getAccessToken
      );
      return data.preview;
    },
    async updateStatus(agentId, status) {
      const data = await request<{ agent: Agent }>(cleanBaseUrl, `/api/agents/${agentId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      }, getAccessToken);
      return data.agent;
    },
    async listAudit(agentId) {
      const data = await request<{ audit: AuditEvent[] }>(cleanBaseUrl, `/api/agents/${agentId}/audit`, undefined, getAccessToken);
      return data.audit;
    },
    async listPredictionMarkets(keyword = "World Cup") {
      const params = new URLSearchParams({ keyword, limit: "10" });
      const data = await request<{ router?: PredictionRouterInfo; markets: PredictionMarket[] }>(
        cleanBaseUrl,
        `/api/prediction/markets?${params.toString()}`,
        undefined,
        getAccessToken
      );
      return data;
    },
    async getV2Home(userId, walletAddress) {
      const path = withQuery("/api/v2/mobile/home", { userId, walletAddress });
      const data = await request<{ home: V2MobileHomeView }>(cleanBaseUrl, path, undefined, getAccessToken);
      return data.home;
    },
    async sendV2Chat(text, userId, walletAddress) {
      const data = await request<{ mobileTurn: V2MobileChatTurn }>(cleanBaseUrl, "/api/v2/phase-one", {
        method: "POST",
        body: JSON.stringify({ text, userId, walletAddress })
      }, getAccessToken);
      return data.mobileTurn;
    },
    async runV2Action(input) {
      const data = await request<{ mobileTurn: V2MobileChatTurn }>(cleanBaseUrl, "/api/v2/phase-one/actions", {
        method: "POST",
        body: JSON.stringify(input)
      }, getAccessToken);
      return data.mobileTurn;
    },
    async listV2Tracking(userId) {
      const data = await request<{ items: V2TrackingCard[] }>(
        cleanBaseUrl,
        withUserId("/api/v2/phase-one/tracking", userId),
        undefined,
        getAccessToken
      );
      return data.items;
    },
    async listV2Strategies(userId) {
      const data = await request<{ items: V2StrategyCard[] }>(
        cleanBaseUrl,
        withUserId("/api/v2/phase-one/strategies", userId),
        undefined,
        getAccessToken
      );
      return data.items;
    },
    async listV2Records(userId) {
      const data = await request<{ items: V2PhaseOneRecord[] }>(
        cleanBaseUrl,
        withUserId("/api/v2/phase-one/records", userId),
        undefined,
        getAccessToken
      );
      return data.items;
    }
  };
}

function withUserId(path: string, userId?: string): string {
  return withQuery(path, { userId });
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (!params.size) return path;
  return `${path}?${params.toString()}`;
}
