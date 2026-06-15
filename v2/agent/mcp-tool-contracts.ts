import type {
  AgentCapabilityRouteMode,
  AgentCapabilityServiceId,
  AgentCapabilityServiceKind
} from "./capability-registry";

export type AgentMcpToolStage = "internal" | "mcp_pending" | "api_pending" | "plugin_pending";

export interface AgentMcpToolContract {
  id: string;
  serviceId: AgentCapabilityServiceId;
  serviceKind: AgentCapabilityServiceKind;
  route: string;
  mode: AgentCapabilityRouteMode;
  toolName: string;
  stage: AgentMcpToolStage;
  safety: "no_external_call" | "read_only" | "dry_run_only";
  externalCallEnabled: false;
  liveExecutionEnabled: false;
  moneyMovementEnabled: false;
  input: {
    required: string[];
    optional: string[];
    redacted: string[];
  };
  output: {
    fields: string[];
    notes: string;
  };
  failure: {
    userSafeStatus: "skipped" | "observed" | "dry_run_completed" | "blocked" | "failed";
    fallbackSummary: string;
  };
}

export const AGENT_MCP_TOOL_CONTRACTS: AgentMcpToolContract[] = [
  {
    id: "hwallet-core:hwallet.receive_address:none",
    serviceId: "hwallet-core",
    serviceKind: "internal",
    route: "hwallet.receive_address",
    mode: "none",
    toolName: "hwallet.receive_address",
    stage: "internal",
    safety: "no_external_call",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["userId", "walletAddress"],
      optional: ["walletStatus"],
      redacted: []
    },
    output: {
      fields: ["receiveAddress", "chainId", "network", "copyAction"],
      notes: "Only the main user-facing receive address is shown."
    },
    failure: {
      userSafeStatus: "skipped",
      fallbackSummary: "HWallet 收款地址由内部钱包上下文生成。"
    }
  },
  {
    id: "hwallet-core:hwallet.wallet_status:none",
    serviceId: "hwallet-core",
    serviceKind: "internal",
    route: "hwallet.wallet_status",
    mode: "none",
    toolName: "hwallet.wallet_status",
    stage: "internal",
    safety: "no_external_call",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["userId", "walletAddress"],
      optional: ["assetSnapshot", "recentRecords"],
      redacted: []
    },
    output: {
      fields: ["fundsStatus", "assetSnapshot", "recentRecords", "nextActionText"],
      notes: "Refreshes HWallet state without external MCP execution."
    },
    failure: {
      userSafeStatus: "skipped",
      fallbackSummary: "HWallet 状态由内部钱包上下文返回。"
    }
  },
  {
    id: "hwallet-core:hwallet.verify_transfer:none",
    serviceId: "hwallet-core",
    serviceKind: "internal",
    route: "hwallet.verify_transfer",
    mode: "none",
    toolName: "hwallet.verify_transfer",
    stage: "internal",
    safety: "no_external_call",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["userId", "walletAddress", "txHash"],
      optional: ["chainId"],
      redacted: []
    },
    output: {
      fields: ["status", "txHash", "amountLabel", "assetSymbol", "explorerUrl"],
      notes: "Verifies inbound transfer records and writes audit memory."
    },
    failure: {
      userSafeStatus: "skipped",
      fallbackSummary: "交易核验失败时只返回用户可读状态，不触发交易。"
    }
  },
  {
    id: "hwallet-core:agent.hold:none",
    serviceId: "hwallet-core",
    serviceKind: "internal",
    route: "agent.hold",
    mode: "none",
    toolName: "agent.hold",
    stage: "internal",
    safety: "no_external_call",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["userText"],
      optional: ["walletStatus"],
      redacted: []
    },
    output: {
      fields: ["progressHint", "friendlyReply"],
      notes: "Keeps the conversation waiting for a clearer business intent."
    },
    failure: {
      userSafeStatus: "skipped",
      fallbackSummary: "等待用户给出更明确的目标。"
    }
  },
  {
    id: "okx-onchainos-skills:prediction.market.observe:observe",
    serviceId: "okx-onchainos-skills",
    serviceKind: "mcp_skill",
    route: "prediction.market.observe",
    mode: "observe",
    toolName: "okx.onchainos.prediction.market.observe",
    stage: "mcp_pending",
    safety: "read_only",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["userText", "walletAddress"],
      optional: ["marketId", "provider", "chainId", "eventId"],
      redacted: ["authorization", "accessToken"]
    },
    output: {
      fields: ["market", "price", "liquidity", "volume", "agentNote"],
      notes: "Reads market context only; the Agent writes analysis and audit."
    },
    failure: {
      userSafeStatus: "observed",
      fallbackSummary: "暂时无法读取外部市场，Agent 会先用已缓存信息分析。"
    }
  },
  {
    id: "okx-onchainos-skills:prediction.order.dry_run:dry_run",
    serviceId: "okx-onchainos-skills",
    serviceKind: "mcp_skill",
    route: "prediction.order.dry_run",
    mode: "dry_run",
    toolName: "okx.onchainos.prediction.order.dry_run",
    stage: "mcp_pending",
    safety: "dry_run_only",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["userText", "walletAddress", "marketId"],
      optional: ["side", "amountUsd", "maxSlippageBps"],
      redacted: ["authorization", "accessToken"]
    },
    output: {
      fields: ["previewId", "side", "amountUsd", "estimatedPrice", "riskNote"],
      notes: "Creates a preview-shaped response only; no order submission."
    },
    failure: {
      userSafeStatus: "dry_run_completed",
      fallbackSummary: "模拟预览暂时不可用，本次不会提交真实订单。"
    }
  },
  {
    id: "okx-outcomes:outcomes.market.observe:observe",
    serviceId: "okx-outcomes",
    serviceKind: "api",
    route: "outcomes.market.observe",
    mode: "observe",
    toolName: "okx.outcomes.market.observe",
    stage: "api_pending",
    safety: "read_only",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["marketId", "chainId"],
      optional: ["eventId", "walletAddress"],
      redacted: ["authorization", "accessToken"]
    },
    output: {
      fields: ["market", "yesPrice", "noPrice", "liquidity", "volume"],
      notes: "Reads OKX Outcomes market data for Agent analysis."
    },
    failure: {
      userSafeStatus: "observed",
      fallbackSummary: "OKX 市场数据暂时不可用，Agent 先使用缓存或样例信息。"
    }
  },
  {
    id: "okx-outcomes:outcomes.order.preview:dry_run",
    serviceId: "okx-outcomes",
    serviceKind: "api",
    route: "outcomes.order.preview",
    mode: "dry_run",
    toolName: "okx.outcomes.order.preview",
    stage: "api_pending",
    safety: "dry_run_only",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["marketId", "chainId", "side", "amountUsd"],
      optional: ["walletAddress", "maxSlippageBps"],
      redacted: ["authorization", "accessToken"]
    },
    output: {
      fields: ["previewId", "side", "amountUsd", "estimatedPrice", "fees"],
      notes: "Produces a dry-run order preview only."
    },
    failure: {
      userSafeStatus: "dry_run_completed",
      fallbackSummary: "订单预览暂时不可用，本次不会提交真实订单。"
    }
  },
  {
    id: "polymarket-plugin:prediction.market.observe:observe",
    serviceId: "polymarket-plugin",
    serviceKind: "plugin",
    route: "prediction.market.observe",
    mode: "observe",
    toolName: "polymarket.market.observe",
    stage: "plugin_pending",
    safety: "read_only",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["marketId"],
      optional: ["eventId", "walletAddress", "chainId"],
      redacted: ["authorization", "accessToken"]
    },
    output: {
      fields: ["market", "yesPrice", "noPrice", "volume", "liquidity"],
      notes: "Reads plugin market data for Agent analysis."
    },
    failure: {
      userSafeStatus: "observed",
      fallbackSummary: "插件市场暂时不可用，Agent 会保持观察模式。"
    }
  },
  {
    id: "polymarket-plugin:prediction.order.dry_run:dry_run",
    serviceId: "polymarket-plugin",
    serviceKind: "plugin",
    route: "prediction.order.dry_run",
    mode: "dry_run",
    toolName: "polymarket.order.dry_run",
    stage: "plugin_pending",
    safety: "dry_run_only",
    externalCallEnabled: false,
    liveExecutionEnabled: false,
    moneyMovementEnabled: false,
    input: {
      required: ["marketId", "side", "amountUsd"],
      optional: ["walletAddress", "maxSlippageBps"],
      redacted: ["authorization", "accessToken"]
    },
    output: {
      fields: ["previewId", "side", "amountUsd", "estimatedPrice", "riskNote"],
      notes: "Generates a plugin dry-run preview only."
    },
    failure: {
      userSafeStatus: "dry_run_completed",
      fallbackSummary: "插件模拟暂时不可用，本次不会提交真实订单。"
    }
  }
];

export function getAgentMcpToolContract(input: {
  serviceId: AgentCapabilityServiceId;
  route: string;
  mode: AgentCapabilityRouteMode;
}): AgentMcpToolContract | undefined {
  return AGENT_MCP_TOOL_CONTRACTS.find((contract) => (
    contract.serviceId === input.serviceId &&
    contract.route === input.route &&
    contract.mode === input.mode
  ));
}
