import { isPolymarketLiveTradingEnabled } from "./onchainos-router";

export interface ExecutionGateStatus {
  paperModeDefault: boolean;
  onchainOsLiveMode: boolean;
  polymarketLiveMode: boolean;
  pluginLiveTradingEnabled: boolean;
  realExecutionEnabled: boolean;
  publicTradingApiConfigured: boolean;
  canBroadcastTransactions: boolean;
  requiredForBroadcast: string[];
  warnings: string[];
}

export function getExecutionGateStatus(): ExecutionGateStatus {
  const pluginLiveTradingEnabled = isPolymarketLiveTradingEnabled();
  const realExecutionEnabled = process.env.AGENT_WALLET_REAL_EXECUTION === "true";
  const publicTradingApiConfigured = process.env.POLYMARKET_TRADING_API_ENABLED === "true";
  const canBroadcastTransactions = pluginLiveTradingEnabled && realExecutionEnabled && publicTradingApiConfigured;

  return {
    paperModeDefault: !pluginLiveTradingEnabled,
    onchainOsLiveMode: process.env.ONCHAINOS_LIVE_MODE === "true",
    polymarketLiveMode: process.env.POLYMARKET_LIVE_MODE === "true",
    pluginLiveTradingEnabled,
    realExecutionEnabled,
    publicTradingApiConfigured,
    canBroadcastTransactions,
    requiredForBroadcast: [
      "ONCHAINOS_LIVE_MODE=true",
      "POLYMARKET_LIVE_MODE=true",
      "AGENT_WALLET_REAL_EXECUTION=true",
      "POLYMARKET_TRADING_API_ENABLED=true",
      "fresh execution preview",
      "confirmed 6-digit code",
      "passing Agent Policy"
    ],
    warnings: canBroadcastTransactions
      ? ["Broadcast gates are open; only use with production storage, monitoring, and tiny allowlisted budgets."]
      : ["Broadcast gates are closed; execution must stay simulated."]
  };
}
