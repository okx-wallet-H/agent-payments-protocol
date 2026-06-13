import type { UserSessionVerifiedWalletTransfer } from "../storage/user-session-store";
import type { XLayerInboundTransfer } from "./xlayer-transaction";

export function toUserSessionVerifiedWalletTransfer(
  transfer: XLayerInboundTransfer
): Omit<UserSessionVerifiedWalletTransfer, "verifiedAt"> {
  return {
    txHash: transfer.txHash,
    status: transfer.status,
    message: transfer.message,
    explorerUrl: transfer.explorerUrl,
    chainId: 196,
    assetSymbol: transfer.assetSymbol,
    amountLabel: transfer.amountLabel,
    tokenAddress: transfer.tokenAddress
  };
}

export function toXLayerInboundTransfer(
  transfer: UserSessionVerifiedWalletTransfer
): XLayerInboundTransfer {
  return {
    txHash: transfer.txHash,
    status: transfer.status,
    chainId: 196,
    explorerUrl: transfer.explorerUrl || `https://www.okx.com/web3/explorer/xlayer/tx/${transfer.txHash}`,
    assetSymbol: transfer.assetSymbol,
    amountLabel: transfer.amountLabel,
    tokenAddress: transfer.tokenAddress,
    message: transfer.message
  };
}
