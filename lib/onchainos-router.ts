import { listPolymarketMarkets } from "./polymarket";
import type { AgentToolRoute, PredictionMarket, PredictionRouterInfo } from "./types";

export function isPolymarketLiveTradingEnabled(): boolean {
  return process.env.ONCHAINOS_LIVE_MODE === "true" && process.env.POLYMARKET_LIVE_MODE === "true";
}

export function getPredictionRouterInfo(): PredictionRouterInfo {
  const liveTradingEnabled = isPolymarketLiveTradingEnabled();

  return {
    name: "onchainos-plugin-router",
    mode: liveTradingEnabled ? "live" : "paper",
    primarySkill: "polymarket-plugin",
    liveTradingEnabled,
    capabilities: [
      "Read public prediction markets through the installed Polymarket plugin",
      "Create policy-checked agent trade intents",
      "Simulate execution records for audit and product testing",
      "Route future live actions through preview and typed confirmation gates"
    ],
    safetyGates: [
      "Paper mode is the default",
      "Live mode requires explicit typed confirmation in the current session",
      "Every write needs a fresh preview before signing or broadcast",
      "Agent policy limits still apply after user confirmation"
    ]
  };
}

export async function listPredictionMarketsViaRouter(keyword = "World Cup", limit = 10) {
  const router = getPredictionRouterInfo();
  const markets = await listPolymarketMarkets(keyword, limit);

  return {
    router,
    provider: "polymarket-plugin" as const,
    liveTradingEnabled: router.liveTradingEnabled,
    markets: markets.map(withPluginMetadata)
  };
}

export function buildPolymarketToolRoute(command = "list-markets"): AgentToolRoute {
  return {
    router: "onchainos-plugin-router",
    skill: "polymarket-plugin",
    command,
    mode: command === "buy" || command === "sell" ? "preview" : "observe",
    chainId: 137
  };
}

export function buildPredictionExecutionPlan(liveTradingEnabled = isPolymarketLiveTradingEnabled()): string[] {
  const plan = [
    "Read market data through Onchain OS polymarket-plugin",
    "Generate an agent intent with confidence, observed price, amount, and reasoning",
    "Run Agent Policy checks for budget, status, market allowlist, and expiry",
    "Write an immutable audit record before any execution path"
  ];

  if (liveTradingEnabled) {
    plan.push("Require a fresh plugin preview and typed user confirmation before buy/sell");
  } else {
    plan.push("Keep execution in simulated mode because plugin live trading gates are disabled");
  }

  return plan;
}

function withPluginMetadata(market: PredictionMarket): PredictionMarket {
  return {
    ...market,
    source: "onchainos_plugin",
    pluginName: "polymarket-plugin"
  };
}
