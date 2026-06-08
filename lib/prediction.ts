import type { Agent, TradeIntent } from "./types";
import {
  buildPolymarketToolRoute,
  buildPredictionExecutionPlan,
  isPolymarketLiveTradingEnabled
} from "./onchainos-router";

export interface PredictionInput {
  market?: string;
  side?: "yes" | "no" | "buy" | "sell" | "hold";
  amountOkb?: number;
  thesis?: string;
  provider?: "okx_observed" | "polymarket_plugin" | "onchainos_plugin";
  externalMarketId?: string;
  externalMarketSlug?: string;
  externalQuestion?: string;
  marketProbability?: number;
  yesPrice?: number;
}

export function createPredictionIntent(agent: Agent, input: PredictionInput): TradeIntent {
  const usesPlugin = input.provider === "polymarket_plugin" || input.provider === "onchainos_plugin";
  const liveTradingEnabled = isPolymarketLiveTradingEnabled();
  const market = input.market || (usesPlugin ? "polymarket-world-cup-2026" : "okx-world-cup-2026");
  const side = input.side || "yes";
  const amountOkb = normalizeAmountOkb(input.amountOkb, Math.min(0.01, agent.policy.maxSingleSpendOkb));
  const thesis =
    input.thesis ||
    (usesPlugin
      ? "Routed through the Onchain OS plugin router and observed public World Cup prediction market data with polymarket-plugin."
      : "Observed OKX Exchange OS World Cup prediction market narrative.");
  const expectedProbability = 0.58;
  const marketProbability = input.marketProbability ?? input.yesPrice ?? 0.5;
  const confidence = 0.62;

  return {
    id: crypto.randomUUID(),
    agentId: agent.id,
    market,
    marketSource: usesPlugin ? "polymarket_plugin" : "okx_observed",
    side,
    amountOkb,
    confidence,
    expectedProbability,
    marketProbability,
    externalMarketId: input.externalMarketId,
    externalMarketSlug: input.externalMarketSlug,
    externalQuestion: input.externalQuestion,
    pluginName: usesPlugin ? "polymarket-plugin" : undefined,
    toolRoute: usesPlugin ? buildPolymarketToolRoute("buy") : undefined,
    executionPlan: usesPlugin ? buildPredictionExecutionPlan(liveTradingEnabled) : undefined,
    liveModeRequired: usesPlugin ? !liveTradingEnabled : undefined,
    previewRequired: usesPlugin ? true : undefined,
    reasoning:
      `${thesis} Agent estimates ${Math.round(expectedProbability * 100)}% fair probability vs ` +
      `${Math.round(marketProbability * 100)}% observed placeholder probability. Execution remains gated by policy.`,
    status: "draft",
    riskNotes: [],
    createdAt: new Date().toISOString()
  };
}

function normalizeAmountOkb(value: number | undefined, fallback: number): number {
  const next = Number(value ?? fallback);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}
