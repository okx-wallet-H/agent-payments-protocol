export function readWalletAddressFromUrl(url: string): `0x${string}` | undefined {
  const value = new URL(url).searchParams.get("walletAddress")?.trim();
  return toHexAddress(value);
}

export function resolveReceiveWalletAddress(input?: string): `0x${string}` | undefined {
  return toHexAddress(input);
}

function toHexAddress(value?: string | null): `0x${string}` | undefined {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return undefined;
  return value as `0x${string}`;
}
