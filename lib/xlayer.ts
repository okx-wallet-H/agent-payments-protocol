import { createPublicClient, formatEther, http, isAddress } from "viem";
import { defineChain } from "viem";

export const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech"]
    },
    public: {
      http: [process.env.XLAYER_FALLBACK_RPC_URL || "https://xlayerrpc.okx.com"]
    }
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/web3/explorer/xlayer"
    }
  }
});

export const xLayerPublicClient = createPublicClient({
  chain: xLayer,
  transport: http(process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech")
});

export function assertEvmAddress(address: string): asserts address is `0x${string}` {
  if (!isAddress(address)) {
    throw new Error("Expected a valid 0x EVM address");
  }
}

export function toXkoDisplayAddress(address: `0x${string}`): string {
  return `XKO${address.slice(2)}`;
}

export function explorerTxUrl(txHash: `0x${string}`): string {
  return `https://www.okx.com/web3/explorer/xlayer/tx/${txHash}`;
}

export async function getOkbBalance(address: `0x${string}`): Promise<string> {
  const balance = await xLayerPublicClient.getBalance({ address });
  return formatEther(balance);
}
