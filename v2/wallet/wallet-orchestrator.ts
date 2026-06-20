import { resolveReceiveWalletAddress } from "./receive-wallet";
import { createDefaultAgentPolicy, type AgentPolicyState } from "../agent/policy";
import type { UserSessionMemory } from "../storage/user-session-store";

export interface AgentWalletContext {
  userId: string;
  receiveAddress?: `0x${string}`;
  chainId: 196;
  network: "X Layer";
  supportedAssets: string[];
  assets: AgentWalletAsset[];
  recentRecords: AgentWalletRecord[];
  status: "ready" | "waiting";
  statusText: string;
  lifecycle: AgentWalletLifecycleStep[];
  agent: AgentWalletAgentState;
  vault: AgentWalletVaultState;
  policy: AgentPolicyState;
  skillBoundary: {
    identity: "privy";
    capabilities: "okx-onchainos-skills";
    liveExecution: "disabled_for_mvp";
  };
}

export interface AgentWalletAsset {
  symbol: AgentWalletAssetSymbol;
  name: string;
  amountLabel: string;
  amountValue?: string;
  valueLabel: string;
  syncStatus: "pending" | "synced" | "failed";
}

export type AgentWalletAssetSymbol = "USDT0" | "USDT" | "OKB";

export interface AgentWalletRecord {
  id: string;
  title: string;
  note: string;
  status: "pending" | "synced" | "failed";
  createdAt: string;
}

export interface AgentWalletLifecycleStep {
  id: "identity" | "wallet" | "assets" | "agent";
  title: string;
  status: "done" | "active" | "waiting" | "failed";
  note: string;
}

export interface AgentWalletAgentState {
  mode: "observe_only";
  fundsStatus: "ready" | "waiting" | "sync_failed";
  availableText: string;
  primaryAsset?: AgentWalletAssetSymbol;
  nextActionText: string;
}

export interface AgentWalletVaultState {
  id: string;
  title: "Agent 资金池";
  status: "ready" | "waiting" | "sync_failed";
  displayText: string;
  policyText: string;
  sourceText: string;
  userVisibleAddress: false;
}

export function createAgentWalletContext(input: {
  userId: string;
  walletAddress?: `0x${string}`;
  memory?: UserSessionMemory;
}): AgentWalletContext {
  const receiveAddress = resolveReceiveWalletAddress(input.walletAddress || input.memory?.walletAddress);
  const hasUserWallet = Boolean(receiveAddress);

  const assets = createPendingAssets();
  const recentRecords = input.memory?.walletRecords?.length
    ? input.memory.walletRecords
    : createPendingRecords(hasUserWallet);
  const agent = createAgentWalletAgentState(assets, recentRecords);
  const vault = createAgentWalletVaultState(assets, recentRecords);

  return {
    userId: input.userId,
    receiveAddress,
    chainId: 196,
    network: "X Layer",
    supportedAssets: ["USDT0", "USDT", "OKB"],
    assets,
    recentRecords,
    status: hasUserWallet ? "ready" : "waiting",
    statusText: hasUserWallet
      ? "HWallet 已经准备好。要充值，直接复制收款地址。"
      : "HWallet 正在生成。地址出来后再展示收款入口。",
    lifecycle: createAgentWalletLifecycle({ hasUserWallet, assets, agent }),
    agent,
    vault,
    policy: createDefaultAgentPolicy(),
    skillBoundary: {
      identity: "privy",
      capabilities: "okx-onchainos-skills",
      liveExecution: "disabled_for_mvp"
    }
  };
}

export function withSyncedAgentWalletState(
  context: AgentWalletContext,
  input: {
    assets: AgentWalletAsset[];
    recentRecords: AgentWalletRecord[];
  }
): AgentWalletContext {
  const agent = createAgentWalletAgentState(input.assets, input.recentRecords);
  return {
    ...context,
    assets: input.assets,
    recentRecords: input.recentRecords,
    lifecycle: createAgentWalletLifecycle({
      hasUserWallet: context.status === "ready",
      assets: input.assets,
      agent
    }),
    agent,
    vault: createAgentWalletVaultState(input.assets, input.recentRecords)
  };
}

export function createWalletKnowledgeNotes(context: AgentWalletContext): string[] {
  return [
    `用户默认钱包网络：${context.network}`,
    context.receiveAddress ? `用户默认收款地址：${context.receiveAddress}` : "用户默认收款地址：等待 HWallet 生成",
    "第一版只开放数据展示、充值收款、模拟和跟踪，不开放真实下单。"
  ];
}

function createPendingAssets(): AgentWalletAsset[] {
  return [
    {
      symbol: "USDT0",
      name: "USD Tether 0",
      amountLabel: "待同步",
      valueLabel: "-",
      syncStatus: "pending"
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      amountLabel: "待同步",
      valueLabel: "-",
      syncStatus: "pending"
    },
    {
      symbol: "OKB",
      name: "X Layer Gas",
      amountLabel: "待同步",
      valueLabel: "-",
      syncStatus: "pending"
    }
  ];
}

function createAgentWalletLifecycle(input: {
  hasUserWallet: boolean;
  assets: AgentWalletAsset[];
  agent: AgentWalletAgentState;
}): AgentWalletLifecycleStep[] {
  const hasSyncedAsset = input.assets.some((asset) => asset.syncStatus === "synced");
  const hasAssetFailure = input.assets.some((asset) => asset.syncStatus === "failed");

  return [
    {
      id: "identity",
      title: "账号",
      status: "done",
      note: "用户会话已创建"
    },
    {
      id: "wallet",
      title: "HWallet",
      status: input.hasUserWallet ? "done" : "active",
      note: input.hasUserWallet ? "钱包已绑定" : "等待钱包生成"
    },
    {
      id: "assets",
      title: "资产",
      status: hasAssetFailure ? "failed" : hasSyncedAsset ? "done" : input.hasUserWallet ? "active" : "waiting",
      note: hasAssetFailure ? "同步待重试" : hasSyncedAsset ? "资产已同步" : input.hasUserWallet ? "正在同步资产" : "等待钱包"
    },
    {
      id: "agent",
      title: "Agent",
      status: input.agent.fundsStatus === "ready" ? "done" : input.agent.fundsStatus === "sync_failed" ? "failed" : "waiting",
      note: input.agent.fundsStatus === "ready" ? "可分析和模拟" : input.agent.fundsStatus === "sync_failed" ? "等待资产恢复" : "等待可用资金"
    }
  ];
}

function createAgentWalletAgentState(
  assets: AgentWalletAsset[],
  recentRecords: AgentWalletRecord[]
): AgentWalletAgentState {
  const syncedAssets = assets.filter((asset) => asset.syncStatus === "synced");
  if (syncedAssets.length === 0 && assets.some((asset) => asset.syncStatus === "failed")) {
    return {
      mode: "observe_only",
      fundsStatus: "sync_failed",
      availableText: "资产同步待重试",
      nextActionText: "可以刷新一次，或者先让 Agent 看市场机会。"
    };
  }

  const usdt0 = assets.find((asset) => asset.symbol === "USDT0" && asset.syncStatus === "synced");
  const usdt = assets.find((asset) => asset.symbol === "USDT" && asset.syncStatus === "synced");
  const okb = assets.find((asset) => asset.symbol === "OKB" && asset.syncStatus === "synced");
  const primary = [usdt0, usdt, okb].find((asset) => Number(asset?.amountValue || "0") > 0);
  const deposit = recentRecords.find(isWalletDepositRecord);

  if (primary) {
    return {
      mode: "observe_only",
      fundsStatus: "ready",
      availableText: `${primary.amountLabel} ${primary.symbol} 可用于 Agent 分析和模拟`,
      primaryAsset: primary.symbol,
      nextActionText: deposit ? "资金已到账，下一步可以让 Agent 看市场机会。" : "可以让 Agent 看市场机会，先模拟不下单。"
    };
  }

  return {
    mode: "observe_only",
    fundsStatus: "waiting",
    availableText: assets.some((asset) => asset.syncStatus === "synced") ? "暂未看到可用资金" : "等待资产同步",
    nextActionText: "充值稳定币到 HWallet 后，Agent 会识别到账状态。"
  };
}

function createAgentWalletVaultState(
  assets: AgentWalletAsset[],
  recentRecords: AgentWalletRecord[]
): AgentWalletVaultState {
  const agent = createAgentWalletAgentState(assets, recentRecords);
  const deposit = recentRecords.find(isWalletDepositRecord);

  if (agent.fundsStatus === "ready") {
    return {
      id: "agent-vault-xlayer-primary",
      title: "Agent 资金池",
      status: "ready",
      displayText: agent.availableText,
      policyText: "第一版只允许分析、跟踪和模拟，不开放真实下单。",
      sourceText: deposit ? "已识别新到账资金" : "使用 HWallet 可用余额",
      userVisibleAddress: false
    };
  }

  if (agent.fundsStatus === "sync_failed") {
    return {
      id: "agent-vault-xlayer-primary",
      title: "Agent 资金池",
      status: "sync_failed",
      displayText: "资金池同步待重试",
      policyText: "不会执行任何资金动作。",
      sourceText: "等待 X Layer 资产同步",
      userVisibleAddress: false
    };
  }

  return {
    id: "agent-vault-xlayer-primary",
    title: "Agent 资金池",
    status: "waiting",
    displayText: "等待充值到账",
    policyText: "到账后先做市场分析和模拟。",
    sourceText: "来自 HWallet 收款地址",
    userVisibleAddress: false
  };
}

function createPendingRecords(hasUserWallet: boolean): AgentWalletRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: "wallet-context-ready",
      title: hasUserWallet ? "钱包已连接" : "等待钱包生成",
      note: hasUserWallet ? "HWallet 已经绑定当前用户，下一步同步 X Layer 资产。" : "登录后会自动生成并绑定 HWallet 地址。",
      status: "pending",
      createdAt: now
    }
  ];
}

function isWalletDepositRecord(record: AgentWalletRecord): boolean {
  return record.id === "wallet-deposit-detected" || record.id.startsWith("wallet-deposit-detected-");
}
