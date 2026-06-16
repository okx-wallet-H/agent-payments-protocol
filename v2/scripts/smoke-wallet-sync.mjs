import { createWalletSyncRecords } from "../wallet/wallet-sync-records.ts";
import { withVerifiedInboundTransfer } from "../wallet/mobile-wallet.ts";
import { createAgentWalletContext, withSyncedAgentWalletState } from "../wallet/wallet-orchestrator.ts";

const nowAssets = [
  {
    symbol: "USDT0",
    name: "USD Tether 0",
    amountLabel: "0.053127",
    amountValue: "0.053127",
    valueLabel: "-",
    syncStatus: "synced"
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    amountLabel: "5",
    amountValue: "5",
    valueLabel: "-",
    syncStatus: "synced"
  },
  {
    symbol: "OKB",
    name: "X Layer Gas",
    amountLabel: "0.01",
    amountValue: "0.01",
    valueLabel: "-",
    syncStatus: "synced"
  }
];

const depositRecords = createWalletSyncRecords({
  assets: nowAssets,
  hasSynced: true,
  previousSnapshot: {
    USDT0: "0",
    USDT: "0",
    OKB: "0.01"
  },
  snapshot: {
    USDT0: "0.053127",
    USDT: "5",
    OKB: "0.01"
  }
});

assert(depositRecords[0]?.title === "资金已到账", "positive delta creates deposit record");
assert(depositRecords[0]?.id?.startsWith("wallet-deposit-detected-"), "deposit record uses stable versioned id");
assert(depositRecords[0]?.note.includes("0.053127 USDT0"), "deposit record describes incoming USDT0");
assert(depositRecords[0]?.note.includes("5 USDT"), "deposit record describes incoming USDT");
assert(!("txHash" in depositRecords[0]), "auto-detected deposit record does not require tx hash");
assert(!depositRecords[0]?.id.startsWith("wallet-tx-"), "auto-detected deposit record stays separate from tx verification");

const repeatedDepositRecords = createWalletSyncRecords({
  assets: nowAssets,
  hasSynced: true,
  previousSnapshot: {
    USDT0: "0",
    USDT: "0",
    OKB: "0.01"
  },
  snapshot: {
    USDT0: "0.053127",
    USDT: "5",
    OKB: "0.01"
  }
});

assert(
  repeatedDepositRecords[0]?.id === depositRecords[0]?.id,
  "same deposit snapshot keeps the same record id"
);

const nextDepositRecords = createWalletSyncRecords({
  assets: [
    {
      ...nowAssets[0],
      amountLabel: "0.153127",
      amountValue: "0.153127"
    },
    nowAssets[1],
    nowAssets[2]
  ],
  hasSynced: true,
  previousSnapshot: {
    USDT0: "0.053127",
    USDT: "5",
    OKB: "0.01"
  },
  snapshot: {
    USDT0: "0.153127",
    USDT: "5",
    OKB: "0.01"
  }
});

assert(
  nextDepositRecords[0]?.id !== depositRecords[0]?.id,
  "new deposit snapshot creates a separate record id"
);

const unchangedRecords = createWalletSyncRecords({
  assets: nowAssets,
  hasSynced: true,
  previousSnapshot: {
    USDT0: "0.053127",
    USDT: "5",
    OKB: "0.01"
  },
  snapshot: {
    USDT0: "0.053127",
    USDT: "5",
    OKB: "0.01"
  }
});

assert(unchangedRecords[0]?.title === "暂无新到账", "unchanged balances create no-new-funds record");

const pendingWallet = createAgentWalletContext({
  userId: "wallet-sync-smoke",
  walletAddress: "0x59029AD72744Ea033a4Ccb261Ec79569e158209e"
});
const detectedDepositWallet = withSyncedAgentWalletState(pendingWallet, {
  assets: nowAssets,
  recentRecords: depositRecords
});
assert(
  detectedDepositWallet.agent.nextActionText.includes("资金已到账"),
  "Agent recognizes versioned deposit records"
);
assert(detectedDepositWallet.agent.fundsStatus === "ready", "auto-detected deposit makes wallet funds ready");
assert(detectedDepositWallet.vault.status === "ready", "auto-detected deposit makes Agent vault ready");
assert(
  detectedDepositWallet.vault.sourceText === "已识别新到账资金",
  "auto-detected deposit is shown as balance recognition"
);

const verifiedWallet = withVerifiedInboundTransfer(pendingWallet, {
  txHash: "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
  status: "received",
  chainId: 196,
  explorerUrl: "https://www.oklink.com/xlayer/tx/0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747",
  assetSymbol: "USDT0",
  amountLabel: "0.053127",
  message: "这笔已到账：0.053127 USDT0。"
});

assert(verifiedWallet.agent.fundsStatus === "ready", "verified tx immediately makes wallet ready");
assert(verifiedWallet.vault.status === "ready", "verified tx immediately makes Agent vault ready");
assert(
  verifiedWallet.lifecycle.some((step) => step.id === "agent" && step.status === "done"),
  "verified tx marks Agent lifecycle ready"
);
assert(
  verifiedWallet.recentRecords[0]?.title === "交易已确认到账",
  "verified tx creates immediate wallet record"
);
assert(
  verifiedWallet.recentRecords[0]?.id?.startsWith("wallet-tx-"),
  "verified tx record stays on transaction-verification path"
);
assert(
  verifiedWallet.assets.some((asset) => asset.symbol === "USDT0" && asset.amountLabel === "0.053127" && asset.syncStatus === "synced"),
  "verified tx updates asset even before balance refresh"
);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "deposit detected",
    "deposit does not require tx hash",
    "deposit id stable per snapshot",
    "deposit id changes for new snapshot",
    "versioned deposit recognized",
    "auto deposit marks Agent funds ready",
    "unchanged balances detected",
    "verified tx makes wallet ready",
    "verified tx marks lifecycle ready",
    "verified tx creates wallet record"
  ],
  deposit: depositRecords[0],
  unchanged: unchangedRecords[0],
  verified: {
    fundsStatus: verifiedWallet.agent.fundsStatus,
    vaultStatus: verifiedWallet.vault.status,
    firstRecord: verifiedWallet.recentRecords[0]?.title
  }
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Wallet sync smoke failed: ${label}`);
}
