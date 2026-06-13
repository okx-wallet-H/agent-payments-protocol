const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `tx-verify-smoke-${Date.now()}`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";

const missingWalletDirect = await postStatus("/api/v2/mobile/wallet/verify-tx", {
  userId: `tx-verify-no-wallet-direct-${Date.now()}`,
  txHash
});
assert(missingWalletDirect.status === 400, "direct tx verification requires a wallet address");
assert(missingWalletDirect.data?.error === "wallet_address_required", "direct tx verification returns wallet required code");

const missingWalletChat = await postStatus("/api/v2/phase-one", {
  userId: `tx-verify-no-wallet-chat-${Date.now()}`,
  text: txHash
});
assert(missingWalletChat.status === 400, "chat tx verification requires a wallet address");
assert(missingWalletChat.data?.error === "wallet_address_required", "chat tx verification returns wallet required code");

const response = await fetch(`${baseUrl}/api/v2/phase-one`, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    userId,
    walletAddress,
    text: txHash
  })
});

const payload = await response.json();

assert(response.status === 201, "tx verification request succeeds");
assert(payload.mobileTurn?.goalType === "wallet_tx_verify", "tx hash routes to wallet tx verification");
const finalText = payload.mobileTurn?.messages?.at(-1)?.text || "";
assert(finalText.includes("这笔已到账"), "final text confirms receipt");
assert(finalText.includes("0.053127 USDT0"), "final text includes received USDT0 amount");

const auditResponse = await fetch(`${baseUrl}/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}`);
const auditPayload = await auditResponse.json();
const txAudit = auditPayload.events?.find((event) => event.type === "wallet.tx_verified");
assert(auditResponse.status === 200, "audit request succeeds");
assert(txAudit?.txHash === txHash, "audit stores tx hash");
assert(txAudit?.amountLabel === "0.053127", "audit stores amount");
assert(txAudit?.assetSymbol === "USDT0", "audit stores asset symbol");
assert(txAudit?.explorerUrl?.includes(txHash), "audit stores explorer link");
assert(txAudit?.walletRecordId === `wallet-tx-${txHash}`, "audit links tx to wallet record");
assert(txAudit?.walletRecord?.id === `wallet-tx-${txHash}`, "audit returns linked wallet record");

const directUserId = `tx-verify-direct-${Date.now()}`;
const directResponse = await fetch(`${baseUrl}/api/v2/mobile/wallet/verify-tx`, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    userId: directUserId,
    walletAddress,
    txHash
  })
});
const directPayload = await directResponse.json();
assert(directResponse.status === 201, "direct wallet tx verification request succeeds");
assert(directPayload.mobileTurn?.goalType === "wallet_tx_verify", "direct tx verification returns wallet turn");
assert(directPayload.mobileTurn?.messages?.at(-1)?.text?.includes("0.053127 USDT0"), "direct tx verification confirms amount");
assert(directPayload.wallet?.agent?.fundsStatus === "ready", "direct tx verification refreshes wallet readiness");
assert(
  directPayload.wallet?.assets?.some((asset) => asset.symbol === "USDT0" && Number(asset.amountValue || "0") > 0),
  "direct tx verification returns refreshed USDT0 asset"
);

const duplicateResponse = await fetch(`${baseUrl}/api/v2/mobile/wallet/verify-tx`, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    userId: directUserId,
    walletAddress,
    txHash
  })
});
const duplicatePayload = await duplicateResponse.json();
assert(duplicateResponse.status === 201, "duplicate direct wallet tx verification request succeeds");
assert(duplicatePayload.verification?.remembered === true, "duplicate tx verification is served from wallet memory");
assert(duplicatePayload.wallet?.agent?.fundsStatus === "ready", "duplicate tx verification keeps wallet ready");

const rememberedWallet = await getJson(`/api/v2/mobile/wallet?userId=${encodeURIComponent(directUserId)}`);
assert(
  rememberedWallet.wallet?.recentRecords?.some((record) => record.id === `wallet-tx-${txHash}`),
  "wallet endpoint remembers verified tx record"
);
assert(
  rememberedWallet.wallet?.agent?.fundsStatus === "ready",
  "wallet endpoint restores ready Agent state from remembered tx record"
);

const agentFollowUpResponse = await fetch(`${baseUrl}/api/v2/phase-one`, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    userId: directUserId,
    text: "好了，继续"
  })
});
const agentFollowUpPayload = await agentFollowUpResponse.json();
assert(agentFollowUpResponse.status === 201, "agent follow-up after verified wallet succeeds");
assert(
  agentFollowUpPayload.mobileTurn?.goalType === "prediction_market_research",
  "verified wallet follow-up enters Agent market analysis"
);
assert(
  agentFollowUpPayload.wallet?.agent?.fundsStatus === "ready",
  "verified wallet follow-up keeps Agent funds ready"
);

const memoryResponse = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(directUserId)}`);
assert(
  memoryResponse.memory?.wallet?.verifiedTransfers?.some((transfer) => transfer.txHash === txHash),
  "mobile memory remembers verified tx hash"
);
assert(
  memoryResponse.memory?.wallet?.records?.some((record) => record.id === `wallet-tx-${txHash}`),
  "mobile memory remembers wallet record"
);

const isolatedUserId = `tx-verify-isolated-${Date.now()}`;
const isolatedWallet = await getJson(
  `/api/v2/mobile/wallet?userId=${encodeURIComponent(isolatedUserId)}&walletAddress=${encodeURIComponent(walletAddress)}`
);
assert(
  !isolatedWallet.wallet?.recentRecords?.some((record) => record.id === `wallet-tx-${txHash}`),
  "other user wallet does not see verified tx record"
);
const isolatedMemory = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(isolatedUserId)}`);
assert(
  !isolatedMemory.memory?.wallet?.verifiedTransfers?.some((transfer) => transfer.txHash === txHash),
  "other user memory does not see verified tx hash"
);
assert(
  !isolatedMemory.memory?.wallet?.records?.some((record) => record.id === `wallet-tx-${txHash}`),
  "other user memory does not see verified tx record"
);

const directAuditResponse = await fetch(`${baseUrl}/api/v2/mobile/audit?userId=${encodeURIComponent(directUserId)}`);
const directAuditPayload = await directAuditResponse.json();
const directTxAudits = directAuditPayload.events?.filter((event) => event.type === "wallet.tx_verified" && event.txHash === txHash) || [];
const followUpPredictionAudit = directAuditPayload.events?.find((event) => event.type === "prediction.analyzed");
assert(directAuditResponse.status === 200, "direct audit request succeeds");
assert(directTxAudits.length === 1, "duplicate tx verification does not duplicate audit event");
assert(directTxAudits[0]?.walletRecordId === `wallet-tx-${txHash}`, "direct tx audit links wallet record");
assert(directTxAudits[0]?.walletRecord?.id === `wallet-tx-${txHash}`, "direct tx audit returns linked wallet record");
assert(followUpPredictionAudit?.moneyMoved === false, "agent follow-up audit records no money movement");
const isolatedAuditResponse = await fetch(`${baseUrl}/api/v2/mobile/audit?userId=${encodeURIComponent(isolatedUserId)}`);
const isolatedAuditPayload = await isolatedAuditResponse.json();
assert(isolatedAuditResponse.status === 200, "isolated user audit request succeeds");
assert(
  !isolatedAuditPayload.events?.some((event) => event.txHash === txHash),
  "other user audit does not see verified tx event"
);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "direct tx requires wallet",
    "chat tx requires wallet",
    "tx hash routed",
    "receipt confirmed",
    "amount displayed",
    "audit recorded",
    "audit links wallet record",
    "audit returns wallet record",
    "direct wallet endpoint works",
    "direct wallet endpoint refreshes wallet state",
    "duplicate tx verification is idempotent",
    "wallet records survive wallet reload",
    "verified wallet follow-up enters Agent market analysis",
    "verified wallet follow-up audit records no money movement",
    "other user wallet memory stays isolated",
    "other user audit stays isolated",
    "wallet records are visible in memory"
  ],
  finalText,
  followUpGoal: agentFollowUpPayload.mobileTurn?.goalType,
  audit: {
    type: txAudit?.type,
    txHash: txAudit?.txHash,
    amountLabel: txAudit?.amountLabel,
    assetSymbol: txAudit?.assetSymbol
  }
}, null, 2));

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${data.error || ""}`.trim());
  return data;
}

function assert(condition, label) {
  if (!condition) throw new Error(`Wallet tx verification smoke failed: ${label}`);
}

async function postStatus(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data
  };
}
