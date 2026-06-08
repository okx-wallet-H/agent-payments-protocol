export const DEFAULT_PHASE_ONE_WALLET_ADDRESS = "0x65a92c1c5da328ae028e80c4fb2bfb223f652669" as const;

export function readWalletAddressFromUrl(url: string): `0x${string}` | undefined {
  const value = new URL(url).searchParams.get("walletAddress")?.trim();
  return toHexAddress(value);
}

export function resolveReceiveWalletAddress(input?: string): `0x${string}` {
  return toHexAddress(input) || DEFAULT_PHASE_ONE_WALLET_ADDRESS;
}

function toHexAddress(value?: string | null): `0x${string}` | undefined {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return undefined;
  return value as `0x${string}`;
}
