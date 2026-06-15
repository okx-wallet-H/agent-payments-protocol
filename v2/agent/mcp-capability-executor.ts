import type { AgentCapabilityRoute } from "./capability-registry";
import { getAgentMcpToolContract, type AgentMcpToolContract } from "./mcp-tool-contracts";
import type { AgentOrchestrationPlan } from "./orchestrator";

export type AgentCapabilityExecutionStatus =
  | "skipped"
  | "observed"
  | "dry_run_completed"
  | "blocked"
  | "failed";

export type AgentCapabilityMcpCallStatus = "not_called" | "mocked";

export interface AgentCapabilityExecutionRequest {
  requestId: string;
  userText: string;
  action: AgentOrchestrationPlan["action"];
  goalType: AgentOrchestrationPlan["goalType"];
  serviceId: NonNullable<AgentCapabilityRoute["serviceId"]>;
  serviceKind: AgentCapabilityRoute["serviceKind"];
  serviceLabel: string;
  route: string;
  mode: AgentCapabilityRoute["mode"];
  safety: AgentCapabilityRoute["safety"];
  capabilityStatus: AgentOrchestrationPlan["capability"]["onchainSkill"]["status"];
  capabilityReason: string;
  walletAddress?: `0x${string}`;
  market?: {
    provider: string;
    chainId: number;
    eventId?: string;
    marketId: string;
    question: string;
  };
  liveExecutionEnabled: false;
  createdAt: string;
}

export interface AgentCapabilityExecutionResult {
  requestId: string;
  serviceId: AgentCapabilityExecutionRequest["serviceId"];
  serviceKind: AgentCapabilityExecutionRequest["serviceKind"];
  serviceLabel: string;
  route: string;
  mode: AgentCapabilityExecutionRequest["mode"];
  safety: AgentCapabilityExecutionRequest["safety"];
  contractId?: string;
  toolName?: string;
  externalCallEnabled: false;
  status: AgentCapabilityExecutionStatus;
  summary: string;
  moneyMoved: false;
  liveExecutionEnabled: false;
  mcpCallStatus: AgentCapabilityMcpCallStatus;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AgentMcpCapabilityExecutor {
  execute(request: AgentCapabilityExecutionRequest): Promise<AgentCapabilityExecutionResult>;
}

export function buildAgentCapabilityExecutionRequest(input: {
  orchestration: AgentOrchestrationPlan;
  userText: string;
  walletAddress?: `0x${string}`;
  requestId?: string;
  now?: string;
}): AgentCapabilityExecutionRequest {
  const capability = input.orchestration.capability.onchainSkill;
  const serviceId = capability.serviceId || toFallbackServiceId(capability.capability);
  const serviceKind = capability.serviceKind || (serviceId === "hwallet-core" ? "internal" : "mcp_skill");
  const createdAt = input.now || new Date().toISOString();

  return {
    requestId: input.requestId || `capability-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    userText: input.userText,
    action: input.orchestration.action,
    goalType: input.orchestration.goalType,
    serviceId,
    serviceKind,
    serviceLabel: capability.serviceLabel || serviceId,
    route: capability.route || "agent.noop",
    mode: capability.mode,
    safety: capability.safety || "no_external_call",
    capabilityStatus: capability.status,
    capabilityReason: capability.reason,
    walletAddress: input.walletAddress,
    market: input.orchestration.candidateMarket
      ? {
          provider: input.orchestration.candidateMarket.provider,
          chainId: input.orchestration.candidateMarket.chainId,
          eventId: input.orchestration.candidateMarket.eventId,
          marketId: input.orchestration.candidateMarket.marketId,
          question: input.orchestration.candidateMarket.question
        }
      : undefined,
    liveExecutionEnabled: false,
    createdAt
  };
}

export async function executeAgentCapability(input: {
  orchestration: AgentOrchestrationPlan;
  userText: string;
  walletAddress?: `0x${string}`;
  executor?: AgentMcpCapabilityExecutor;
}): Promise<AgentCapabilityExecutionResult> {
  const request = buildAgentCapabilityExecutionRequest(input);
  return (input.executor || safeMockMcpExecutor).execute(request);
}

export async function executeAgentCapabilitySafely(input: {
  orchestration: AgentOrchestrationPlan;
  userText: string;
  walletAddress?: `0x${string}`;
  executor?: AgentMcpCapabilityExecutor;
}): Promise<AgentCapabilityExecutionResult> {
  try {
    return await executeAgentCapability(input);
  } catch {
    const request = buildAgentCapabilityExecutionRequest(input);
    return createResult(request, {
      status: "failed",
      summary: "能力执行层未完成预览，本次没有调用外部服务，也没有发生资金动作。",
      mcpCallStatus: "not_called",
      payload: {
        errorCode: "capability_executor_failed",
        externalCall: false
      }
    });
  }
}

export const safeMockMcpExecutor: AgentMcpCapabilityExecutor = {
  async execute(request) {
    if (request.capabilityStatus === "blocked") {
      return createResult(request, {
        status: "blocked",
        summary: request.capabilityReason,
        mcpCallStatus: "not_called",
        payload: {
          reason: request.capabilityReason,
          externalCall: false
        }
      });
    }

    if (request.mode === "none" || request.safety === "no_external_call") {
      return createResult(request, {
        status: "skipped",
        summary: "这一步由 HWallet 内部完成，不需要调用 MCP 服务。",
        mcpCallStatus: "not_called",
        payload: {
          externalCall: false
        }
      });
    }

    if (request.mode === "observe") {
      return createResult(request, {
        status: "observed",
        summary: "已生成只读观察任务，等待接入真实 MCP 后可读取市场和链上数据。",
        mcpCallStatus: "mocked",
        payload: {
          externalCall: false,
          mockOnly: true,
          marketId: request.market?.marketId
        }
      });
    }

    return createResult(request, {
      status: "dry_run_completed",
      summary: "已生成模拟执行预览，当前不提交真实交易。",
      mcpCallStatus: "mocked",
      payload: {
        externalCall: false,
        mockOnly: true,
        marketId: request.market?.marketId
      }
    });
  }
};

function createResult(
  request: AgentCapabilityExecutionRequest,
  input: {
    status: AgentCapabilityExecutionStatus;
    summary: string;
    mcpCallStatus: AgentCapabilityMcpCallStatus;
    payload: Record<string, unknown>;
  }
): AgentCapabilityExecutionResult {
  const contract = getAgentMcpToolContract({
    serviceId: request.serviceId,
    route: request.route,
    mode: request.mode
  });
  return {
    requestId: request.requestId,
    serviceId: request.serviceId,
    serviceKind: request.serviceKind,
    serviceLabel: request.serviceLabel,
    route: request.route,
    mode: request.mode,
    safety: request.safety,
    contractId: contract?.id,
    toolName: contract?.toolName,
    externalCallEnabled: false,
    status: input.status,
    summary: input.summary,
    moneyMoved: false,
    liveExecutionEnabled: false,
    mcpCallStatus: input.mcpCallStatus,
    payload: {
      ...input.payload,
      toolContract: contract ? toPayloadContract(contract) : undefined
    },
    createdAt: request.createdAt
  };
}

function toPayloadContract(contract: AgentMcpToolContract): Record<string, unknown> {
  return {
    id: contract.id,
    toolName: contract.toolName,
    stage: contract.stage,
    requiredInputs: contract.input.required,
    optionalInputs: contract.input.optional,
    redactedInputs: contract.input.redacted,
    outputFields: contract.output.fields,
    externalCallEnabled: contract.externalCallEnabled,
    moneyMovementEnabled: contract.moneyMovementEnabled
  };
}

function toFallbackServiceId(
  capability: AgentOrchestrationPlan["capability"]["onchainSkill"]["capability"]
): AgentCapabilityExecutionRequest["serviceId"] {
  if (capability === "okx-onchainos-skills") return "okx-onchainos-skills";
  return "hwallet-core";
}
