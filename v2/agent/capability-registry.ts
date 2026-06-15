import type { BusinessGoalType, MarketSnapshot } from "../domain/types";
import type { AgentOrchestratorAction } from "./orchestrator";

export type AgentCapabilityServiceId =
  | "hwallet-core"
  | "okx-onchainos-skills"
  | "okx-outcomes"
  | "polymarket-plugin";

export type AgentCapabilityServiceKind = "internal" | "mcp_skill" | "api" | "plugin";

export type AgentCapabilityRouteMode = "none" | "observe" | "dry_run";

export interface AgentCapabilityRoute {
  serviceId: AgentCapabilityServiceId;
  serviceKind: AgentCapabilityServiceKind;
  label: string;
  mode: AgentCapabilityRouteMode;
  command: string;
  safety: "no_external_call" | "read_only" | "dry_run_only";
  liveExecutionEnabled: false;
  reason: string;
}

export const AGENT_CAPABILITY_SERVICES: Array<{
  id: AgentCapabilityServiceId;
  kind: AgentCapabilityServiceKind;
  label: string;
  liveExecutionEnabled: false;
  supportedModes: AgentCapabilityRouteMode[];
}> = [
  {
    id: "hwallet-core",
    kind: "internal",
    label: "HWallet Core",
    liveExecutionEnabled: false,
    supportedModes: ["none"]
  },
  {
    id: "okx-onchainos-skills",
    kind: "mcp_skill",
    label: "OKX Onchain OS Skills",
    liveExecutionEnabled: false,
    supportedModes: ["observe", "dry_run"]
  },
  {
    id: "okx-outcomes",
    kind: "api",
    label: "OKX Outcomes API",
    liveExecutionEnabled: false,
    supportedModes: ["observe", "dry_run"]
  },
  {
    id: "polymarket-plugin",
    kind: "plugin",
    label: "Polymarket Plugin",
    liveExecutionEnabled: false,
    supportedModes: ["observe", "dry_run"]
  }
];

export function selectAgentCapabilityRoute(input: {
  action: AgentOrchestratorAction;
  goalType: BusinessGoalType;
  market?: MarketSnapshot;
}): AgentCapabilityRoute {
  if (input.action === "analyze_worldcup_market") {
    const service = getMarketService(input.market);
    return {
      serviceId: service.id,
      serviceKind: service.kind,
      label: service.label,
      mode: "observe",
      command: service.id === "okx-outcomes" ? "outcomes.market.observe" : "prediction.market.observe",
      safety: "read_only",
      liveExecutionEnabled: false,
      reason: "读取市场、赔率、热度和资金变化，只生成分析结果。"
    };
  }

  if (input.action === "simulate_prediction") {
    const service = getMarketService(input.market);
    return {
      serviceId: service.id,
      serviceKind: service.kind,
      label: service.label,
      mode: "dry_run",
      command: service.id === "okx-outcomes" ? "outcomes.order.preview" : "prediction.order.dry_run",
      safety: "dry_run_only",
      liveExecutionEnabled: false,
      reason: "只做订单预览和模拟，不提交真实订单。"
    };
  }

  return {
    serviceId: "hwallet-core",
    serviceKind: "internal",
    label: "HWallet Core",
    mode: "none",
    command: getInternalCommand(input.action),
    safety: "no_external_call",
    liveExecutionEnabled: false,
    reason: "这一步只处理钱包、会话或用户输入，不需要外部 MCP 服务。"
  };
}

function getMarketService(market?: MarketSnapshot): (typeof AGENT_CAPABILITY_SERVICES)[number] {
  if (market?.provider === "okx-outcomes") return getService("okx-outcomes");
  if (market?.provider === "polymarket-plugin") return getService("polymarket-plugin");
  return getService("okx-onchainos-skills");
}

function getService(id: AgentCapabilityServiceId): (typeof AGENT_CAPABILITY_SERVICES)[number] {
  return AGENT_CAPABILITY_SERVICES.find((service) => service.id === id) || AGENT_CAPABILITY_SERVICES[0];
}

function getInternalCommand(action: AgentOrchestratorAction): string {
  if (action === "show_receive_address") return "hwallet.receive_address";
  if (action === "check_wallet_funds") return "hwallet.wallet_status";
  if (action === "verify_wallet_transaction") return "hwallet.verify_transfer";
  return "agent.hold";
}
