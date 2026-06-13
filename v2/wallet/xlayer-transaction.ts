import { formatEther, formatUnits, isHash, type Hash } from "viem";
import { explorerTxUrl, xLayerPublicClient } from "../../lib/xlayer";
import { XLAYER_TRACKED_TOKENS } from "./xlayer-assets";
import type { AgentWalletAssetSymbol } from "./wallet-orchestrator";

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface XLayerInboundTransfer {
  txHash: Hash;
  status: "received" | "not_for_wallet" | "failed" | "not_found" | "unsupported_asset";
  chainId: 196;
  explorerUrl: string;
  from?: `0x${string}`;
  to?: `0x${string}`;
  assetSymbol?: AgentWalletAssetSymbol;
  tokenAddress?: `0x${string}`;
  amountLabel?: string;
  blockNumber?: string;
  message: string;
}

export function extractTxHash(text: string): Hash | undefined {
  const match = text.match(/0x[a-fA-F0-9]{64}/);
  if (!match || !isHash(match[0])) return undefined;
  return match[0] as Hash;
}

export async function verifyXLayerInboundTransfer(input: {
  txHash: Hash;
  walletAddress: `0x${string}`;
}): Promise<XLayerInboundTransfer> {
  const explorerUrl = explorerTxUrl(input.txHash);

  try {
    const [transaction, receipt] = await Promise.all([
      xLayerPublicClient.getTransaction({ hash: input.txHash }),
      xLayerPublicClient.getTransactionReceipt({ hash: input.txHash })
    ]);

    if (receipt.status !== "success") {
      return {
        txHash: input.txHash,
        status: "failed",
        chainId: 196,
        explorerUrl,
        blockNumber: receipt.blockNumber?.toString(),
        message: "这笔交易没有成功上链，我先不把它算作到账。"
      };
    }

    const nativeValue = transaction.value || 0n;
    if (nativeValue > 0n && sameAddress(transaction.to, input.walletAddress)) {
      const amountLabel = formatAssetAmount(formatEther(nativeValue));
      return {
        txHash: input.txHash,
        status: "received",
        chainId: 196,
        explorerUrl,
        from: transaction.from,
        to: transaction.to || undefined,
        assetSymbol: "OKB",
        amountLabel,
        blockNumber: receipt.blockNumber?.toString(),
        message: `这笔已到账：${amountLabel} OKB。`
      };
    }

    const transfer = receipt.logs
      .map((log) => decodeTrackedTransferLog(log))
      .find((item) => item && sameAddress(item.to, input.walletAddress));

    if (transfer) {
      return {
        txHash: input.txHash,
        status: "received",
        chainId: 196,
        explorerUrl,
        from: transfer.from,
        to: transfer.to,
        tokenAddress: transfer.tokenAddress,
        assetSymbol: transfer.symbol,
        amountLabel: transfer.amountLabel,
        blockNumber: receipt.blockNumber?.toString(),
        message: `这笔已到账：${transfer.amountLabel} ${transfer.symbol}。`
      };
    }

    const hasUnsupportedInbound = receipt.logs
      .map((log) => decodeAnyTransferLog(log))
      .some((item) => item && sameAddress(item.to, input.walletAddress));

    if (hasUnsupportedInbound) {
      return {
        txHash: input.txHash,
        status: "unsupported_asset",
        chainId: 196,
        explorerUrl,
        blockNumber: receipt.blockNumber?.toString(),
        message: "这笔转到了 HWallet，但资产暂时不在当前识别列表里。"
      };
    }

    return {
      txHash: input.txHash,
      status: "not_for_wallet",
      chainId: 196,
      explorerUrl,
      blockNumber: receipt.blockNumber?.toString(),
      message: "这笔交易成功了，但收款地址不是当前 HWallet。"
    };
  } catch {
    return {
      txHash: input.txHash,
      status: "not_found",
      chainId: 196,
      explorerUrl,
      message: "我暂时没有在 X Layer 查到这笔交易，可能还在确认中。"
    };
  }
}

function decodeTrackedTransferLog(log: {
  address: `0x${string}`;
  topics: readonly [`0x${string}`, ...`0x${string}`[]] | readonly `0x${string}`[];
  data: `0x${string}`;
}) {
  const transfer = decodeAnyTransferLog(log);
  if (!transfer) return undefined;
  const token = XLAYER_TRACKED_TOKENS.find((item) => sameAddress(item.address, log.address));
  if (!token) return undefined;
  return {
    ...transfer,
    tokenAddress: token.address,
    symbol: token.symbol,
    amountLabel: formatAssetAmount(formatUnits(transfer.value, token.decimals))
  };
}

function decodeAnyTransferLog(log: {
  address: `0x${string}`;
  topics: readonly [`0x${string}`, ...`0x${string}`[]] | readonly `0x${string}`[];
  data: `0x${string}`;
}) {
  if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC || log.topics.length < 3) return undefined;
  return {
    from: topicToAddress(log.topics[1]),
    to: topicToAddress(log.topics[2]),
    value: BigInt(log.data || "0x0")
  };
}

function topicToAddress(topic: `0x${string}` | undefined): `0x${string}` {
  return `0x${(topic || "0x").slice(-40)}` as `0x${string}`;
}

function sameAddress(left?: `0x${string}` | null, right?: `0x${string}` | null): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
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
