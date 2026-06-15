import type { PrivyHWalletStatus } from "./privy-wallet-status";
import type { V2WalletContext } from "./types";

export interface HWalletEntryStateInput {
  busy?: boolean;
  isProvisioning?: boolean;
  privyStatus: PrivyHWalletStatus;
  provisionError?: string;
  sessionError?: string;
  wallet?: V2WalletContext;
  walletAddress?: string;
}

export interface HWalletEntryState {
  canAskAgent: boolean;
  canRetryProvisioning: boolean;
  canUseReceiveAddress: boolean;
  displayAddress?: string;
  networkLabel: string;
  receiveHint: string;
  statusLabel: string;
  walletNotice?: string;
  walletTxCheckDisabled: boolean;
}

export function createHWalletEntryState(input: HWalletEntryStateInput): HWalletEntryState {
  const isSignedOut = input.privyStatus.kind === "signed_out";
  const displayAddress = isSignedOut
    ? undefined
    : input.walletAddress || (input.wallet?.status === "ready" ? input.wallet.address : undefined);
  const canUseReceiveAddress = Boolean(displayAddress);
  const canRetryProvisioning = Boolean(
    input.privyStatus.needsProvisioning &&
      !input.busy &&
      !input.isProvisioning &&
      !canUseReceiveAddress
  );
  const rawWalletNotice = input.sessionError ||
    (input.privyStatus.kind === "binding_mismatch" ? input.privyStatus.detail : undefined) ||
    (!canUseReceiveAddress ? input.provisionError : undefined);
  const walletNotice = createFriendlyWalletNotice(rawWalletNotice);

  return {
    canAskAgent: !input.busy && !isSignedOut,
    canRetryProvisioning,
    canUseReceiveAddress,
    displayAddress,
    networkLabel: input.wallet?.network || "X Layer",
    receiveHint: input.isProvisioning || !canUseReceiveAddress
      ? input.privyStatus.detail
      : input.wallet?.statusText || "支持稳定币 / OKB 转入，到账后 Agent 会自动识别可用资金。",
    statusLabel: input.privyStatus.label,
    walletNotice,
    walletTxCheckDisabled: Boolean(input.busy || !canUseReceiveAddress)
  };
}

function createFriendlyWalletNotice(notice?: string): string | undefined {
  const normalized = notice?.trim();
  if (!normalized) return undefined;

  const lower = normalized.toLowerCase();
  if (lower.includes("privy") || lower.includes("access token") || lower.includes("unauthorized")) {
    return "登录状态正在同步，请稍后再试。";
  }

  return normalized;
}
