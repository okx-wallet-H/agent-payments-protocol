import type { ReceiveAddress, ReceiveCard } from "../domain/types";

export function createReceiveCard(addresses: ReceiveAddress[]): ReceiveCard {
  return {
    type: "receive_card",
    title: "充值地址",
    addresses: addresses.slice(0, 1),
    primaryAction: "copy"
  };
}

export function createDefaultReceiveAddresses(input: {
  xLayerAddress: `0x${string}`;
  polygonAddress: `0x${string}`;
}): ReceiveAddress[] {
  return [
    {
      id: "xlayer-agent-wallet",
      label: "Agent 钱包",
      network: "X Layer",
      chainId: 196,
      address: input.xLayerAddress,
      supportedAssets: ["USDT", "OKB"]
    },
    {
      id: "polymarket-strategy-wallet",
      label: "策略交易",
      network: "Polygon",
      chainId: 137,
      address: input.polygonAddress,
      supportedAssets: ["USDC.e", "POL"]
    }
  ];
}
