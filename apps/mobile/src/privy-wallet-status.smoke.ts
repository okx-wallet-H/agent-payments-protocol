import { createPrivyHWalletStatus } from "./privy-wallet-status";
import { createHWalletEntryState } from "./hwallet-entry";
import type { V2WalletContext } from "./types";

const checks: string[] = [];

assert(createPrivyHWalletStatus({ isReady: false, hasUser: false }).kind === "booting", "booting status");
assert(createPrivyHWalletStatus({ isReady: true, hasUser: false }).kind === "signed_out", "signed-out status");
assert(
  createPrivyHWalletStatus({ isReady: true, hasUser: true, isProvisioning: true }).kind === "creating",
  "creating status"
);
assert(
  createPrivyHWalletStatus({ isReady: true, hasUser: true, walletAddress: "0xabc" }).kind === "ready",
  "ready status"
);
assert(
  createPrivyHWalletStatus({
    isReady: true,
    hasUser: true,
    walletAddress: "0xabc",
    backendWalletAddress: "0xabc"
  }).kind === "backend_bound",
  "backend-bound status"
);
assert(
  createPrivyHWalletStatus({
    isReady: true,
    hasUser: true,
    walletAddress: "0xabc",
    backendWalletAddress: "0xdef"
  }).kind === "binding_mismatch",
  "binding mismatch status"
);
assert(
  createPrivyHWalletStatus({ isReady: true, hasUser: true, provisionError: "failed" }).needsProvisioning,
  "failed status can retry provisioning"
);
assert(
  createPrivyHWalletStatus({
    isReady: true,
    hasUser: true,
    walletAddress: "0xabc",
    provisionError: "failed"
  }).kind === "ready",
  "wallet address wins over stale provision error"
);
assert(
  createPrivyHWalletStatus({
    isReady: true,
    hasUser: true,
    walletAddress: "0xabc",
    backendWalletAddress: "0xabc",
    provisionError: "failed"
  }).kind === "backend_bound",
  "backend-bound wallet wins over stale provision error"
);
assert(
  createPrivyHWalletStatus({
    isReady: true,
    hasUser: true,
    backendWalletAddress: "0xabc",
    provisionError: "failed"
  }).kind === "backend_bound",
  "backend-only wallet can receive while local SDK catches up"
);

const readyStatus = createPrivyHWalletStatus({
  isReady: true,
  hasUser: true,
  walletAddress: "0x1111111111111111111111111111111111111111",
  backendWalletAddress: "0x1111111111111111111111111111111111111111"
});

const readyWallet = {
  userId: "demo-user",
  address: "0x1111111111111111111111111111111111111111",
  chainId: 196,
  network: "X Layer",
  assets: [],
  recentRecords: [],
  status: "ready",
  statusText: "HWallet 已经准备好。",
  agent: {
    mode: "observe_only",
    fundsStatus: "waiting",
    availableText: "暂未看到可用资金",
    nextActionText: "充值后 Agent 会识别到账状态。"
  },
  vault: {
    id: "agent-vault-smoke",
    title: "Agent 资金池",
    status: "waiting",
    displayText: "等待充值到账",
    policyText: "第一版只做分析、跟踪和模拟。",
    sourceText: "来自 HWallet 收款地址",
    userVisibleAddress: false
  },
  policy: {
    id: "agent-policy-mvp-observe-only",
    mode: "mvp_observe_only",
    allowedActions: ["analyze", "track", "build_strategy", "simulate"],
    liveExecutionEnabled: false,
    maxSimulationUsd: 100,
    allowedProviders: ["okx-outcomes", "polymarket-plugin"],
    allowedChains: [196, 137],
    policyText: "第一版只允许分析、跟踪和模拟，不开放真实下单。"
  }
} as V2WalletContext;

const signedOutEntry = createHWalletEntryState({
  privyStatus: createPrivyHWalletStatus({ isReady: true, hasUser: false })
});
assert(!signedOutEntry.canUseReceiveAddress, "signed-out HWallet entry cannot receive");
assert(signedOutEntry.walletTxCheckDisabled, "signed-out HWallet entry disables tx check");
assert(signedOutEntry.receiveHint.includes("邮箱登录"), "signed-out HWallet entry keeps friendly login hint");
assert(!signedOutEntry.canRetryProvisioning, "signed-out HWallet entry does not retry wallet creation");
assert(!signedOutEntry.canAskAgent, "signed-out HWallet entry pauses Agent actions");

const signedOutStaleWalletEntry = createHWalletEntryState({
  privyStatus: createPrivyHWalletStatus({ isReady: true, hasUser: false }),
  walletAddress: "0x1111111111111111111111111111111111111111",
  wallet: readyWallet
});
assert(!signedOutStaleWalletEntry.displayAddress, "signed-out HWallet entry hides stale wallet address");
assert(!signedOutStaleWalletEntry.canUseReceiveAddress, "signed-out HWallet entry cannot receive with stale wallet");

const failedProvisionEntry = createHWalletEntryState({
  privyStatus: createPrivyHWalletStatus({ isReady: true, hasUser: true, provisionError: "failed" }),
  provisionError: "failed"
});
assert(failedProvisionEntry.canRetryProvisioning, "failed HWallet entry can retry wallet creation");
assert(failedProvisionEntry.walletNotice === "failed", "failed HWallet entry surfaces provision error");

const creatingEntry = createHWalletEntryState({
  isProvisioning: true,
  privyStatus: createPrivyHWalletStatus({ isReady: true, hasUser: true, isProvisioning: true })
});
assert(!creatingEntry.canRetryProvisioning, "creating HWallet entry avoids duplicate wallet creation");

const localWalletEntry = createHWalletEntryState({
  privyStatus: readyStatus,
  walletAddress: "0x2222222222222222222222222222222222222222"
});
assert(localWalletEntry.displayAddress === "0x2222222222222222222222222222222222222222", "HWallet entry prefers local embedded wallet address");
assert(localWalletEntry.canUseReceiveAddress, "HWallet entry can receive with local wallet address");
assert(!localWalletEntry.canRetryProvisioning, "ready HWallet entry hides retry wallet creation");
assert(!localWalletEntry.walletTxCheckDisabled, "HWallet entry enables tx check with wallet address");

const staleErrorWalletEntry = createHWalletEntryState({
  privyStatus: createPrivyHWalletStatus({
    isReady: true,
    hasUser: true,
    walletAddress: "0x2222222222222222222222222222222222222222",
    provisionError: "failed"
  }),
  provisionError: "failed",
  walletAddress: "0x2222222222222222222222222222222222222222"
});
assert(staleErrorWalletEntry.canUseReceiveAddress, "HWallet entry can receive when stale provision error has wallet");
assert(!staleErrorWalletEntry.canRetryProvisioning, "HWallet entry hides retry when stale provision error has wallet");
assert(!staleErrorWalletEntry.walletNotice, "HWallet entry hides stale provision error when wallet is usable");

const backendWalletEntry = createHWalletEntryState({
  privyStatus: readyStatus,
  wallet: readyWallet
});
assert(backendWalletEntry.displayAddress === readyWallet.address, "HWallet entry can use backend-bound wallet address");
assert(backendWalletEntry.networkLabel === "X Layer", "HWallet entry keeps X Layer network label");
assert(backendWalletEntry.receiveHint === readyWallet.statusText, "HWallet entry uses wallet status text");

const busyWalletEntry = createHWalletEntryState({
  busy: true,
  privyStatus: readyStatus,
  wallet: readyWallet
});
assert(!busyWalletEntry.canAskAgent, "busy HWallet entry pauses Agent action");
assert(busyWalletEntry.walletTxCheckDisabled, "busy HWallet entry disables tx check");
assert(!busyWalletEntry.canRetryProvisioning, "busy HWallet entry disables retry wallet creation");

const mismatchStatus = createPrivyHWalletStatus({
  isReady: true,
  hasUser: true,
  walletAddress: "0xabc",
  backendWalletAddress: "0xdef"
});
const mismatchEntry = createHWalletEntryState({
  privyStatus: mismatchStatus,
  walletAddress: "0xabc"
});
assert(mismatchEntry.walletNotice?.includes("重新同步"), "HWallet entry surfaces binding mismatch notice");

console.log(JSON.stringify({ ok: true, checks }, null, 2));

function assert(condition: unknown, label: string) {
  if (!condition) throw new Error(`Privy wallet status smoke failed: ${label}`);
  checks.push(label);
}
