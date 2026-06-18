import { getExecutionGateStatus } from "../../lib/execution-gates.ts";

const gateKeys = [
  "ONCHAINOS_LIVE_MODE",
  "POLYMARKET_LIVE_MODE",
  "AGENT_WALLET_REAL_EXECUTION",
  "POLYMARKET_TRADING_API_ENABLED"
];

const originalEnv = Object.fromEntries(gateKeys.map((key) => [key, process.env[key]]));
const checks = [];

try {
  applyEnv({});
  const closed = getExecutionGateStatus();
  check(closed.canBroadcastTransactions === false, "default gate keeps transaction broadcast closed");
  check(closed.paperModeDefault === true, "paper mode is default when live flags are absent");
  check(closed.pluginLiveTradingEnabled === false, "plugin live trading is off by default");
  check(closed.warnings.some((warning) => /closed|simulated/i.test(warning)), "closed gate warning is explicit");

  applyEnv({
    ONCHAINOS_LIVE_MODE: "true",
    POLYMARKET_LIVE_MODE: "true"
  });
  const pluginOnly = getExecutionGateStatus();
  check(pluginOnly.pluginLiveTradingEnabled === true, "plugin live trading requires both plugin live flags");
  check(pluginOnly.canBroadcastTransactions === false, "plugin live mode alone cannot broadcast");
  check(pluginOnly.realExecutionEnabled === false, "real execution still closed without AGENT_WALLET_REAL_EXECUTION");
  check(pluginOnly.publicTradingApiConfigured === false, "public trading API still closed without explicit flag");

  applyEnv({
    AGENT_WALLET_REAL_EXECUTION: "true",
    POLYMARKET_TRADING_API_ENABLED: "true"
  });
  const executionOnly = getExecutionGateStatus();
  check(executionOnly.pluginLiveTradingEnabled === false, "execution flags do not imply plugin live mode");
  check(executionOnly.canBroadcastTransactions === false, "execution flags alone cannot broadcast");

  applyEnv({
    ONCHAINOS_LIVE_MODE: "true",
    POLYMARKET_LIVE_MODE: "true",
    AGENT_WALLET_REAL_EXECUTION: "true",
    POLYMARKET_TRADING_API_ENABLED: "true"
  });
  const allOpen = getExecutionGateStatus();
  check(allOpen.pluginLiveTradingEnabled === true, "all-open scenario enables plugin live mode");
  check(allOpen.realExecutionEnabled === true, "all-open scenario enables real execution flag");
  check(allOpen.publicTradingApiConfigured === true, "all-open scenario enables public trading API flag");
  check(allOpen.canBroadcastTransactions === true, "broadcast only opens when every required env gate is true");
  for (const required of gateKeys.map((key) => `${key}=true`)) {
    check(allOpen.requiredForBroadcast.includes(required), `required broadcast checklist includes ${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    checks,
    default: pickGate(closed),
    pluginOnly: pickGate(pluginOnly),
    executionOnly: pickGate(executionOnly),
    allOpen: pickGate(allOpen)
  }, null, 2));
} finally {
  restoreEnv();
}

function applyEnv(values) {
  for (const key of gateKeys) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function pickGate(status) {
  return {
    paperModeDefault: status.paperModeDefault,
    pluginLiveTradingEnabled: status.pluginLiveTradingEnabled,
    realExecutionEnabled: status.realExecutionEnabled,
    publicTradingApiConfigured: status.publicTradingApiConfigured,
    canBroadcastTransactions: status.canBroadcastTransactions
  };
}

function check(condition, label) {
  if (!condition) throw new Error(`Execution gates smoke failed: ${label}`);
  checks.push(label);
}
