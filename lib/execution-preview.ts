import { getPredictionRouterInfo } from "./onchainos-router";
import { getExecutionGateStatus } from "./execution-gates";
import type { Agent, ExecutionPreview, ExecutionSafetySummary, TradeIntent } from "./types";

export function createExecutionPreview(agent: Agent, intent: TradeIntent, warnings: string[]): ExecutionPreview {
  const router = getPredictionRouterInfo();
  const gates = getExecutionGateStatus();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const isPluginIntent = intent.marketSource === "polymarket_plugin";
  const estimatedGasOkb = router.liveTradingEnabled && isPluginIntent ? 0.001 : 0;
  const provider = isPluginIntent ? "polymarket" : "simulator";
  const mode = router.mode;
  const estimatedCostOkb = gates.canBroadcastTransactions ? intent.amountOkb + estimatedGasOkb : 0;
  const previewWarnings = [
    ...warnings,
    ...(router.liveTradingEnabled
      ? ["Live mode is enabled; a fresh typed confirmation is still required before any write."]
      : ["Paper mode is active; this preview cannot sign or broadcast a transaction."]),
    ...(gates.canBroadcastTransactions ? [] : ["Broadcast gates are closed; this preview cannot move funds."])
  ];

  return {
    id: crypto.randomUUID(),
    agentId: agent.id,
    intentId: intent.id,
    provider,
    mode,
    market: intent.market,
    side: intent.side,
    amountOkb: intent.amountOkb,
    estimatedCostOkb,
    estimatedGasOkb,
    price: intent.marketProbability,
    toolRoute: intent.toolRoute,
    warnings: previewWarnings,
    safetySummary: createExecutionSafetySummary({
      provider,
      mode,
      amountOkb: intent.amountOkb,
      estimatedCostOkb,
      warnings: previewWarnings,
      requiresConfirmation: isPluginIntent,
      canBroadcastTransactions: gates.canBroadcastTransactions
    }),
    confirmationText: isPluginIntent ? "confirm live mode" : undefined,
    confirmationCode: isPluginIntent ? createConfirmationCode() : undefined,
    confirmationStatus: isPluginIntent ? "pending" : "not_required",
    confirmationAttempts: 0,
    maxConfirmationAttempts: 5,
    expiresAt,
    createdAt: now.toISOString()
  };
}

export function createExecutionSafetySummary(input: {
  provider: ExecutionPreview["provider"];
  mode: ExecutionPreview["mode"];
  amountOkb: number;
  estimatedCostOkb: number;
  warnings: string[];
  requiresConfirmation: boolean;
  canBroadcastTransactions?: boolean;
}): ExecutionSafetySummary {
  const willMoveFunds = Boolean(input.canBroadcastTransactions && input.mode === "live" && input.provider !== "simulator");
  const modeLabel = willMoveFunds ? "实盘" : "安全演练";
  const amountLabel = willMoveFunds
    ? `最多预计使用 ${formatOkb(input.estimatedCostOkb || input.amountOkb)} OKB`
    : `方案金额 ${formatOkb(input.amountOkb)} OKB，当前不会真实扣款`;
  const riskLevel = willMoveFunds ? (input.warnings.length > 1 ? "high" : "medium") : "low";

  return {
    title: willMoveFunds ? "这一步可能动用小金库" : "这一步只是安全演练",
    modeLabel,
    willMoveFunds,
    amountLabel,
    riskLevel,
    userChecklist: [
      "AI 只能先给方案，不能绕过确认直接动钱。",
      input.requiresConfirmation ? "继续前必须输入 6 位确认码。" : "当前方案不需要真实签名。",
      "确认码输错过多会锁定，需要重新生成方案。",
      "每一步都会写入透明记录，方便回看和追责。",
      willMoveFunds ? "实盘时只允许按预算和白名单小额执行。" : "当前不会签名、不会广播、不会真实下单。"
    ]
  };
}

export function findFreshPreview(agent: Agent, intentId: string, previewId?: string): ExecutionPreview | undefined {
  const now = Date.now();
  return (agent.previews || []).find(
    (preview) =>
      preview.intentId === intentId &&
      (!previewId || preview.id === previewId) &&
      Date.parse(preview.expiresAt) > now
  );
}

export function confirmExecutionPreview(
  preview: ExecutionPreview,
  confirmationText: string,
  confirmedBy?: string
): ExecutionPreview {
  if (Date.parse(preview.expiresAt) <= Date.now()) {
    return {
      ...preview,
      confirmationStatus: "expired"
    };
  }

  if (preview.confirmationStatus === "locked") {
    throw new Error("确认码已输错过多次，请重新生成方案。");
  }

  if (!preview.confirmationText) {
    return {
      ...preview,
      confirmationStatus: "not_required"
    };
  }

  const input = confirmationText.trim();
  const validText = input === preview.confirmationText;
  const validCode = Boolean(preview.confirmationCode && input === preview.confirmationCode);
  if (!validText && !validCode) {
    return rejectExecutionPreviewConfirmation(preview);
  }

  return {
    ...preview,
    confirmationStatus: "confirmed",
    confirmedAt: new Date().toISOString(),
    confirmedBy
  };
}

export function rejectExecutionPreviewConfirmation(preview: ExecutionPreview): ExecutionPreview {
  const confirmationAttempts = (preview.confirmationAttempts || 0) + 1;
  const maxConfirmationAttempts = preview.maxConfirmationAttempts || 5;
  return {
    ...preview,
    confirmationAttempts,
    maxConfirmationAttempts,
    confirmationStatus: confirmationAttempts >= maxConfirmationAttempts ? "locked" : preview.confirmationStatus
  };
}

function createConfirmationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function formatOkb(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, "") : "0";
}
