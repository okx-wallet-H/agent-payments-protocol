import type { AgentWalletAsset, AgentWalletRecord } from "./wallet-orchestrator";
import type { XLayerWalletAssetSnapshot } from "./xlayer-assets";

export function createWalletSyncRecords(input: {
  assets: AgentWalletAsset[];
  hasSynced: boolean;
  previousSnapshot?: XLayerWalletAssetSnapshot;
  snapshot: XLayerWalletAssetSnapshot;
}): AgentWalletRecord[] {
  const now = new Date().toISOString();
  if (!input.hasSynced) {
    return [
      {
        id: "wallet-assets-sync-failed",
        title: "资产同步待重试",
        note: "当前 RPC 暂时没有返回余额，稍后可刷新。",
        status: "failed",
        createdAt: now
      }
    ];
  }

  const deposits = input.assets
    .map((asset) => {
      if (asset.syncStatus !== "synced" || asset.amountValue === undefined) return undefined;
      const previous = input.previousSnapshot?.[asset.symbol];
      if (previous === undefined) return undefined;
      const delta = Number(asset.amountValue) - Number(previous);
      if (!Number.isFinite(delta) || delta <= 0) return undefined;
      return `${formatAssetAmount(String(delta))} ${asset.symbol}`;
    })
    .filter(Boolean) as string[];

  if (deposits.length > 0) {
    return [
      {
        id: `wallet-deposit-detected-${createSnapshotSignature(input.snapshot)}`,
        title: "资金已到账",
        note: `新到账 ${deposits.join(" / ")}，Agent 可以继续分析或模拟。`,
        status: "synced",
        createdAt: now
      }
    ];
  }

  return [
    {
      id: "wallet-assets-sync",
      title: input.previousSnapshot ? "暂无新到账" : "资产已同步",
      note: input.previousSnapshot ? "已刷新 X Layer 资产，余额暂时没有变化。" : "已读取 X Layer 上的稳定币 / OKB 余额。",
      status: "synced",
      createdAt: now
    }
  ];
}

function formatAssetAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0";
  if (numeric < 0.000001) return "<0.000001";
  if (numeric < 1) return trimZeros(numeric.toFixed(6));
  if (numeric < 1000) return trimZeros(numeric.toFixed(4));
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(numeric);
}

function trimZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

function createSnapshotSignature(snapshot: XLayerWalletAssetSnapshot): string {
  const source = (["USDT0", "USDT", "OKB"] as const)
    .map((symbol) => `${symbol}:${snapshot[symbol] || "0"}`)
    .join("|");
  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}
