import { readXLayerWalletAssets } from "./xlayer-assets";
import { type XLayerInboundTransfer } from "./xlayer-transaction";
import {
  type AgentWalletAsset,
  type AgentWalletContext,
  createWalletKnowledgeNotes,
  withSyncedAgentWalletState
} from "./wallet-orchestrator";
import type { UserSessionMemory } from "../storage/user-session-store";

export type SyncedAgentWalletContext = AgentWalletContext & {
  assetSnapshot?: Awaited<ReturnType<typeof readXLayerWalletAssets>>["snapshot"];
};

export async function syncAgentWalletContext(
  wallet: AgentWalletContext,
  memory?: Pick<UserSessionMemory, "walletAssetSnapshot" | "walletRecords">
): Promise<SyncedAgentWalletContext> {
  if (wallet.status !== "ready") return wallet;

  try {
    const synced = await readXLayerWalletAssets(wallet.receiveAddress, memory?.walletAssetSnapshot);
    return {
      ...withSyncedAgentWalletState(wallet, {
        assets: synced.assets,
        recentRecords: mergeWalletRecords(synced.records, memory?.walletRecords || wallet.recentRecords)
      }),
      assets: synced.assets,
      recentRecords: mergeWalletRecords(synced.records, memory?.walletRecords || wallet.recentRecords),
      assetSnapshot: synced.snapshot
    };
  } catch {
    return wallet;
  }
}

export function toMobileWalletContext(wallet: SyncedAgentWalletContext) {
  return {
    userId: wallet.userId,
    address: wallet.receiveAddress,
    chainId: wallet.chainId,
    network: wallet.network,
    assets: wallet.assets,
    recentRecords: wallet.recentRecords,
    status: wallet.status,
    statusText: wallet.statusText,
    lifecycle: wallet.lifecycle,
    agent: wallet.agent,
    vault: wallet.vault,
    policy: wallet.policy
  };
}

export function createMobileWalletKnowledgeNotes(wallet: SyncedAgentWalletContext): string[] {
  return createWalletKnowledgeNotes(wallet);
}

export function withVerifiedInboundTransfer(
  wallet: SyncedAgentWalletContext,
  transfer: XLayerInboundTransfer
): SyncedAgentWalletContext {
  if (transfer.status !== "received" || !transfer.assetSymbol || !transfer.amountLabel) return wallet;

  const assetSymbol = transfer.assetSymbol;
  const amountLabel = transfer.amountLabel;
  const assets = wallet.assets.map((asset) => {
    if (asset.symbol !== assetSymbol) return asset;
    return mergeVerifiedAsset(asset, amountLabel);
  });
  const hasAsset = assets.some((asset) => asset.symbol === assetSymbol);
  const verifiedAsset: AgentWalletAsset = {
    symbol: assetSymbol,
    name: assetSymbol,
    amountLabel,
    amountValue: normalizeAmountValue(amountLabel),
    valueLabel: "-",
    syncStatus: "synced"
  };
  const nextAssets: AgentWalletAsset[] = hasAsset
    ? assets
    : [
        ...assets,
        verifiedAsset
      ];
  const nextWallet = withSyncedAgentWalletState(wallet, {
    assets: nextAssets,
    recentRecords: [
      {
        id: `wallet-tx-${transfer.txHash}`,
        title: "交易已确认到账",
        note: `${amountLabel} ${assetSymbol} 已计入 HWallet，Agent 可以继续分析或模拟。`,
        status: "synced",
        createdAt: new Date().toISOString()
      },
      ...wallet.recentRecords.filter((record) => record.id !== `wallet-tx-${transfer.txHash}`)
    ]
  }) as SyncedAgentWalletContext;

  return {
    ...nextWallet,
    assetSnapshot: {
      ...(wallet.assetSnapshot || {}),
      [assetSymbol]: nextAssets.find((asset) => asset.symbol === assetSymbol)?.amountValue || normalizeAmountValue(amountLabel)
    }
  };
}

export function createWalletFundReply(wallet: SyncedAgentWalletContext): string {
  const deposit = wallet.recentRecords.find(isWalletDepositRecord);
  if (deposit) return `${deposit.note} 我先帮你看市场机会。`;

  const assets = createSyncedAssetText(wallet);
  const synced = wallet.recentRecords.find((record) => record.status === "synced");
  if (synced?.title === "暂无新到账" && assets) return `我刷新过了，当前 HWallet 可用 ${assets}。`;
  if (synced?.title === "暂无新到账") return "我刷新过了，暂时没看到新的到账。你可以稍后再说一声好了，我会再查一次。";
  if (synced?.title === "资产已同步" && assets) return `我已经同步到 HWallet 资产了，当前 ${assets}。`;
  if (synced?.title === "资产已同步") return "我已经同步到 HWallet 资产了。现在可以先看市场机会，或者继续等充值到账。";

  return wallet.statusText;
}

export function createWalletStatusReply(wallet: SyncedAgentWalletContext): string {
  const assets = createSyncedAssetText(wallet);
  if (assets) return `HWallet 已经准备好。当前 ${assets}。`;
  return wallet.statusText;
}

export function createWalletTxReply(tx: XLayerInboundTransfer): string {
  if (tx.status === "received") {
    return `${tx.message} 当前已计入 HWallet，可让 Agent 继续分析或模拟。`;
  }
  return tx.message;
}

export function createWalletAuditNote(wallet: SyncedAgentWalletContext): string {
  const deposit = wallet.recentRecords.find(isWalletDepositRecord);
  if (deposit) return `${deposit.note} 未发生真实下单。`;
  const synced = wallet.recentRecords.find((record) => record.status === "synced");
  if (synced) return `${synced.note} 未发生资金动作。`;
  return "已刷新钱包状态，未发生资金动作。";
}

function createSyncedAssetText(wallet: SyncedAgentWalletContext): string {
  return wallet.assets
    .filter((asset) => asset.syncStatus === "synced")
    .map((asset) => `${asset.symbol} ${asset.amountLabel}`)
    .join("，");
}

function mergeVerifiedAsset(asset: AgentWalletAsset, amountLabel: string): AgentWalletAsset {
  const incomingValue = normalizeAmountValue(amountLabel);
  const currentValue = normalizeAmountValue(asset.amountValue || "0");
  const nextValue = Math.max(Number(currentValue), Number(incomingValue));
  if (Number.isFinite(nextValue) && nextValue > 0) {
    return {
      ...asset,
      amountLabel: formatAmountValue(nextValue),
      amountValue: String(nextValue),
      syncStatus: "synced"
    };
  }

  return {
    ...asset,
    amountLabel,
    amountValue: incomingValue,
    syncStatus: "synced"
  };
}

function normalizeAmountValue(value: string): string {
  const normalized = value.replace(/,/g, "").replace(/^</, "").trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0";
  return String(numeric);
}

function formatAmountValue(value: number): string {
  if (value === 0) return "0";
  if (value < 0.000001) return "<0.000001";
  if (value < 1) return trimZeros(value.toFixed(6));
  if (value < 1000) return trimZeros(value.toFixed(4));
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function trimZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

function mergeWalletRecords(incoming: AgentWalletContext["recentRecords"], existing: AgentWalletContext["recentRecords"]) {
  const byId = new Map<string, AgentWalletContext["recentRecords"][number]>();
  for (const record of [...incoming, ...existing]) {
    if (!byId.has(record.id)) byId.set(record.id, record);
  }
  return [...byId.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 40);
}

function isWalletDepositRecord(record: AgentWalletContext["recentRecords"][number]): boolean {
  return record.id === "wallet-deposit-detected" || record.id.startsWith("wallet-deposit-detected-");
}
