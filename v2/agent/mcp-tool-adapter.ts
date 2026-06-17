import type { AgentCapabilityExecutionRequest } from "./mcp-capability-executor";
import type { AgentMcpToolContract } from "./mcp-tool-contracts";

export type AgentMcpToolAdapterStatus =
  | "not_required"
  | "disabled"
  | "blocked"
  | "ready"
  | "failed";

export interface AgentMcpToolAdapterInvocation {
  requestId: string;
  contractId?: string;
  toolName?: string;
  serviceId: AgentCapabilityExecutionRequest["serviceId"];
  route: string;
  mode: AgentCapabilityExecutionRequest["mode"];
  safety: AgentCapabilityExecutionRequest["safety"];
  input: Record<string, unknown>;
  redactedInputs: string[];
  externalCallEnabled: boolean;
  liveExecutionEnabled: false;
  moneyMovementEnabled: false;
}

export interface AgentMcpToolAdapterResult {
  status: AgentMcpToolAdapterStatus;
  contractId?: string;
  toolName?: string;
  summary: string;
  externalCallAttempted: false;
  liveExecutionEnabled: false;
  moneyMoved: false;
  payload: Record<string, unknown>;
}

export interface AgentMcpToolAdapter {
  invoke(invocation: AgentMcpToolAdapterInvocation): Promise<AgentMcpToolAdapterResult>;
}

export function buildAgentMcpToolAdapterInvocation(input: {
  request: AgentCapabilityExecutionRequest;
  contract?: AgentMcpToolContract;
}): AgentMcpToolAdapterInvocation {
  return {
    requestId: input.request.requestId,
    contractId: input.contract?.id,
    toolName: input.contract?.toolName,
    serviceId: input.request.serviceId,
    route: input.request.route,
    mode: input.request.mode,
    safety: input.request.safety,
    input: {
      userText: input.request.userText,
      walletAddress: input.request.walletAddress,
      market: input.request.market
    },
    redactedInputs: input.contract?.input.redacted || [],
    externalCallEnabled: Boolean(input.contract?.externalCallEnabled),
    liveExecutionEnabled: false,
    moneyMovementEnabled: false
  };
}

export async function runAgentMcpToolAdapterSafely(input: {
  request: AgentCapabilityExecutionRequest;
  contract?: AgentMcpToolContract;
  adapter?: AgentMcpToolAdapter;
}): Promise<AgentMcpToolAdapterResult> {
  const invocation = buildAgentMcpToolAdapterInvocation({
    request: input.request,
    contract: input.contract
  });

  if (!input.contract) {
    return createAdapterResult(invocation, {
      status: "not_required",
      summary: "没有匹配的 MCP 工具契约，本次不调用外部服务。",
      payload: { reason: "missing_contract" }
    });
  }

  if (input.request.capabilityStatus === "blocked") {
    return createAdapterResult(invocation, {
      status: "blocked",
      summary: input.request.capabilityReason,
      payload: { reason: input.request.capabilityReason }
    });
  }

  if (input.contract.stage === "internal" || input.request.mode === "none") {
    return createAdapterResult(invocation, {
      status: "not_required",
      summary: "这一步由 HWallet 内部完成，不需要 MCP adapter。",
      payload: { stage: input.contract.stage }
    });
  }

  if (!input.contract.externalCallEnabled) {
    return createAdapterResult(invocation, {
      status: "disabled",
      summary: "真实 MCP 调用尚未启用，本次只生成安全预览结果。",
      payload: createSafePreviewPayload(invocation, input.contract)
    });
  }

  if (!input.adapter) {
    return createAdapterResult(invocation, {
      status: "disabled",
      summary: "MCP 工具已配置契约，但尚未挂载 adapter 实现。",
      payload: {
        reason: "adapter_missing",
        toolName: input.contract.toolName
      }
    });
  }

  try {
    const result = await input.adapter.invoke(invocation);
    return {
      ...result,
      externalCallAttempted: false,
      liveExecutionEnabled: false,
      moneyMoved: false
    };
  } catch {
    return createAdapterResult(invocation, {
      status: "failed",
      summary: "MCP adapter 执行失败，本次没有发生资金动作。",
      payload: { errorCode: "mcp_adapter_failed" }
    });
  }
}

function createAdapterResult(
  invocation: AgentMcpToolAdapterInvocation,
  input: {
    status: AgentMcpToolAdapterStatus;
    summary: string;
    payload: Record<string, unknown>;
  }
): AgentMcpToolAdapterResult {
  return {
    status: input.status,
    contractId: invocation.contractId,
    toolName: invocation.toolName,
    summary: input.summary,
    externalCallAttempted: false,
    liveExecutionEnabled: false,
    moneyMoved: false,
    payload: {
      ...input.payload,
      externalCallEnabled: invocation.externalCallEnabled,
      redactedInputs: invocation.redactedInputs
    }
  };
}

function createSafePreviewPayload(
  invocation: AgentMcpToolAdapterInvocation,
  contract: AgentMcpToolContract
): Record<string, unknown> {
  return {
    stage: contract.stage,
    toolName: contract.toolName,
    preview: {
      serviceId: invocation.serviceId,
      route: invocation.route,
      mode: invocation.mode,
      safety: invocation.safety,
      market: createMarketPreview(invocation.input.market),
      inputShape: {
        required: contract.input.required,
        optional: contract.input.optional,
        redacted: contract.input.redacted
      },
      outputFields: contract.output.fields,
      outputNotes: contract.output.notes,
      externalCallEnabled: false,
      liveExecutionEnabled: false,
      moneyMovementEnabled: false
    }
  };
}

function createMarketPreview(market: unknown): Record<string, unknown> | undefined {
  if (!market || typeof market !== "object") return undefined;
  const value = market as {
    provider?: unknown;
    chainId?: unknown;
    eventId?: unknown;
    marketId?: unknown;
    question?: unknown;
  };

  return {
    provider: typeof value.provider === "string" ? value.provider : undefined,
    chainId: typeof value.chainId === "number" ? value.chainId : undefined,
    eventId: typeof value.eventId === "string" ? value.eventId : undefined,
    marketId: typeof value.marketId === "string" ? value.marketId : undefined,
    question: typeof value.question === "string" ? value.question : undefined
  };
}
