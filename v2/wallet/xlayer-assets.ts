import { erc20Abi, formatEther, formatUnits } from "viem";
import { xLayerPublicClient } from "../../lib/xlayer";
import type { AgentWalletAsset, AgentWalletAssetSymbol, AgentWalletRecord } from "./wallet-orchestrator";
import type { UserSessionMemory } from "../storage/user-session-store";
import { createWalletSyncRecords } from "./wallet-sync-records";

const DEFAULT_XLAYER_USDT0_ADDRESS = "0x779ded0c9e1022225f8e0630b35a9b54be713736" as const;
const DEFAULT_XLAYER_USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" as const;
const XLAYER_USDT0_ADDRESS = (process.env.XLAYER_USDT0_CONTRACT_ADDRESS || DEFAULT_XLAYER_USDT0_ADDRESS) as `0x${string}`;
const XLAYER_USDT_ADDRESS = (process.env.XLAYER_USDT_CONTRACT_ADDRESS || DEFAULT_XLAYER_USDT_ADDRESS) as `0x${string}`;

export const XLAYER_TRACKED_TOKENS = [
  {
    address: XLAYER_USDT0_ADDRESS.toLowerCase() as `0x${string}`,
    symbol: "USDT0" as const,
    name: "USD Tether 0",
    decimals: 6
  },
  {
    address: XLAYER_USDT_ADDRESS.toLowerCase() as `0x${string}`,
    symbol: "USDT" as const,
    name: "Tether USD",
    decimals: 6
  }
];

export type XLayerWalletAssetSnapshot = NonNullable<UserSessionMemory["walletAssetSnapshot"]>;

export async function readXLayerWalletAssets(address: `0x${string}`, previousSnapshot?: XLayerWalletAssetSnapshot): Promise<{
  assets: AgentWalletAsset[];
  records: AgentWalletRecord[];
  snapshot: XLayerWalletAssetSnapshot;
}> {
  const [okb, usdt0, usdt] = await Promise.all([
    readOkbAsset(address),
    readTokenAsset(address, {
      address: XLAYER_TRACKED_TOKENS[0].address,
      symbol: "USDT0",
      name: "USD Tether 0"
    }),
    readTokenAsset(address, {
      address: XLAYER_TRACKED_TOKENS[1].address,
      symbol: "USDT",
      name: "Tether USD"
    })
  ]);
  const hasSynced = okb.syncStatus === "synced" || usdt0.syncStatus === "synced" || usdt.syncStatus === "synced";

  const assets = [usdt0, usdt, okb];
  const snapshot = createAssetSnapshot(assets);

  return {
    assets,
    records: createWalletSyncRecords({
      assets,
      hasSynced,
      previousSnapshot,
      snapshot
    }),
    snapshot
  };
}

async function readOkbAsset(address: `0x${string}`): Promise<AgentWalletAsset> {
  try {
    const balance = await xLayerPublicClient.getBalance({ address });
    const amountValue = formatEther(balance);
    return {
      symbol: "OKB",
      name: "X Layer Gas",
      amountLabel: formatAssetAmount(amountValue),
      amountValue,
      valueLabel: "-",
      syncStatus: "synced"
    };
  } catch {
    return createFailedAsset("OKB", "X Layer Gas");
  }
}

async function readTokenAsset(
  owner: `0x${string}`,
  token: {
    address: `0x${string}`;
    symbol: AgentWalletAssetSymbol;
    name: string;
  }
): Promise<AgentWalletAsset> {
  try {
    const [balance, decimals] = await Promise.all([
      xLayerPublicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner]
      }),
      xLayerPublicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "decimals"
      })
    ]);

    const amountValue = formatUnits(balance, decimals);
    return {
      symbol: token.symbol,
      name: token.name,
      amountLabel: formatAssetAmount(amountValue),
      amountValue,
      valueLabel: "-",
      syncStatus: "synced"
    };
  } catch {
    return createFailedAsset(token.symbol, token.name);
  }
}

function createAssetSnapshot(assets: AgentWalletAsset[]): XLayerWalletAssetSnapshot {
  return assets.reduce<XLayerWalletAssetSnapshot>((snapshot, asset) => {
    if (asset.syncStatus === "synced" && asset.amountValue !== undefined) {
      snapshot[asset.symbol] = asset.amountValue;
    }
    return snapshot;
  }, {});
}


function createFailedAsset(symbol: AgentWalletAssetSymbol, name: string): AgentWalletAsset {
  return {
    symbol,
    name,
    amountLabel: "待同步",
    valueLabel: "-",
    syncStatus: "failed"
  };
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
