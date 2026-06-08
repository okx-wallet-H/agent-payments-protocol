import { createExecutionPreview, findFreshPreview } from "./execution-preview";
import { getExecutionGateStatus } from "./execution-gates";
import { isPolymarketLiveTradingEnabled } from "./onchainos-router";
import { evaluateIntent } from "./risk";
import type { Agent, AuditEvent, ExecutionPreview, ExecutionRecord, TradeIntent } from "./types";

export interface PreviewIntentResult {
  intent: TradeIntent;
  preview: ExecutionPreview;
}

export interface ExecuteIntentResult {
  execution: ExecutionRecord;
  intents: TradeIntent[];
  auditType: AuditEvent["type"];
  auditMessage: string;
  auditMetadata: Record<string, unknown>;
  statusCode: number;
}

export function createPreviewForIntent(agent: Agent, intentId?: string): PreviewIntentResult {
  const intent = findIntent(agent, intentId);
  const riskNotes = evaluateIntent(agent, intent);
  const preview = createExecutionPreview(agent, intent, riskNotes);
  return { intent, preview };
}

export function executeAgentIntent(agent: Agent, intentId?: string, previewId?: string): ExecuteIntentResult {
  const intent = findIntent(agent, intentId);
  const riskNotes = evaluateIntent(agent, intent);

  if (riskNotes.length > 0) {
    const blocked: ExecutionRecord = {
      id: crypto.randomUUID(),
      agentId: agent.id,
      intentId: intent.id,
      status: "blocked",
      costOkb: 0,
      error: riskNotes.join("; "),
      createdAt: new Date().toISOString()
    };

    return {
      execution: blocked,
      intents: agent.intents.map((item) =>
        item.id === intent.id ? { ...item, status: "blocked", riskNotes } : item
      ),
      auditType: "intent.blocked",
      auditMessage: "Execution blocked by policy",
      auditMetadata: { intentId: intent.id, riskNotes },
      statusCode: 403
    };
  }

  const freshPreview = findFreshPreview(agent, intent.id, previewId);
  const previewRequirement = getPreviewRequirement(agent, intent);

  if (previewRequirement.required && (!freshPreview || freshPreview.confirmationStatus !== "confirmed")) {
    const preview = (agent.previews || []).find(
      (item) => item.intentId === intent.id && (!previewId || item.id === previewId)
    );
    const reason = getPreviewBlockReason(preview);
    const blocked: ExecutionRecord = {
      id: crypto.randomUUID(),
      agentId: agent.id,
      intentId: intent.id,
      status: "blocked",
      costOkb: 0,
      error: reason,
      provider: "polymarket",
      createdAt: new Date().toISOString()
    };

    return {
      execution: blocked,
      intents: agent.intents.map((item) =>
        item.id === intent.id ? { ...item, status: "blocked", riskNotes: [blocked.error || ""] } : item
      ),
      auditType: "intent.blocked",
      auditMessage: "Execution blocked because preview confirmation is required",
      auditMetadata: {
        intentId: intent.id,
        previewId,
        previewStatus: preview?.confirmationStatus,
        previewRequiredBy: previewRequirement.reasons
      },
      statusCode: 403
    };
  }

  const gates = getExecutionGateStatus();
  const exchangeOsPublicTradingApiAvailable = gates.publicTradingApiConfigured && gates.realExecutionEnabled;
  const polymarketLiveTradingEnabled = isPolymarketLiveTradingEnabled();
  const shouldSimulate =
    intent.marketSource === "okx_observed" ||
    (intent.marketSource === "polymarket_plugin" && !polymarketLiveTradingEnabled) ||
    !exchangeOsPublicTradingApiAvailable;

  const execution: ExecutionRecord = {
    id: crypto.randomUUID(),
    agentId: agent.id,
    intentId: intent.id,
    status: shouldSimulate ? "simulated" : "executed",
    costOkb: shouldSimulate ? 0 : intent.amountOkb,
    error: shouldSimulate
      ? intent.marketSource === "polymarket_plugin"
        ? `Onchain OS polymarket-plugin market data is available, but buy/sell remains simulated until all broadcast gates are open: ${gates.requiredForBroadcast.join(", ")}.`
        : "OKX Exchange OS prediction market public trading API is not configured; simulated execution only."
      : undefined,
    provider: intent.marketSource === "polymarket_plugin" ? "polymarket" : "simulator",
    createdAt: new Date().toISOString()
  };

  return {
    execution,
    intents: agent.intents.map((item) =>
      item.id === intent.id ? { ...item, status: shouldSimulate ? "simulated" : "executed" } : item
    ),
    auditType: shouldSimulate ? "execution.simulated" : "execution.executed",
    auditMessage: shouldSimulate ? "Prediction intent simulated" : "Prediction intent executed",
    auditMetadata: { intentId: intent.id, previewId: freshPreview?.id, execution, gates },
    statusCode: 200
  };
}

function findIntent(agent: Agent, intentId?: string): TradeIntent {
  const intent = intentId ? agent.intents.find((item) => item.id === intentId) : agent.intents[0];
  if (!intent) throw new Error("No intent found");
  return intent;
}

function getPreviewRequirement(agent: Agent, intent: TradeIntent): { required: boolean; reasons: string[] } {
  const reasons = [
    ...(intent.previewRequired ? ["intent.previewRequired"] : []),
    ...(intent.marketSource === "polymarket_plugin" ? ["polymarket_plugin"] : []),
    ...(agent.memory?.riskProfile.requiresPreviewBeforeExecution ? ["agent.memory.requiresPreviewBeforeExecution"] : []),
    ...(agent.memory?.riskProfile.requiresTypedConfirmation ? ["agent.memory.requiresTypedConfirmation"] : [])
  ];

  return {
    required: reasons.length > 0,
    reasons
  };
}

function getPreviewBlockReason(preview?: ExecutionPreview): string {
  if (!preview) return "Execution requires a fresh safety preview and 6-digit confirmation before continuing.";
  if (Date.parse(preview.expiresAt) <= Date.now()) {
    return "Execution preview has expired; create a fresh preview and confirm it before continuing.";
  }
  if (preview.confirmationStatus === "locked") {
    return "Execution preview is locked because the confirmation code was entered incorrectly too many times.";
  }
  return `Execution requires a confirmed safety preview before continuing; current preview status is ${preview.confirmationStatus}.`;
}
