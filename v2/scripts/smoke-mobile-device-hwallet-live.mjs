import { readFile } from "node:fs/promises";

await loadLocalEnv();

const baseUrl = getDeviceBaseUrl();
const baseUrlInfo = classifyBaseUrl(baseUrl);
const userId = `mobile-device-hwallet-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";
const checks = [];

assert(baseUrlInfo.kind !== "missing", "device API base URL is configured");
assert(baseUrlInfo.valid, "device API base URL is valid");
if (process.env.ALLOW_LOCAL_MOBILE_DEVICE_SMOKE !== "true") {
  assert(baseUrlInfo.kind !== "localhost", "device API base URL is not localhost");
}

const health = await getJson("/api/v2/system/storage");
assert(health.service === "hwallet-v2", "device API reaches HWallet V2 storage health");

const home = await getJson(
  `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`
);
assert(home.home?.type === "mobile_home_view", "device API returns mobile home");
assert(sameHex(home.wallet?.address, walletAddress), "device API binds HWallet address");
assert(home.wallet?.vault?.userVisibleAddress === false, "device API keeps internal vault address hidden");
assert(home.wallet?.policy?.liveExecutionEnabled === false, "device API keeps live execution disabled");

const recharge = await postJson("/api/v2/phase-one", {
  userId,
  walletAddress,
  text: "我要充值"
});
assert(recharge.mobileTurn?.goalType === "wallet_receive", "device API returns receive flow");
const receiveCard = recharge.mobileTurn?.cards?.find((card) => card.type === "receive_card");
assert(receiveCard?.addresses?.length === 1, "receive flow exposes one HWallet address");
assert(sameHex(receiveCard?.addresses?.[0]?.address, walletAddress), "receive flow uses current HWallet address");

const verified = await postJson("/api/v2/mobile/wallet/verify-tx", {
  userId,
  walletAddress,
  txHash
});
assert(verified.mobileTurn?.goalType === "wallet_tx_verify", "device API verifies wallet tx");
assert(verified.wallet?.agent?.fundsStatus === "ready", "verified tx makes Agent funds ready");
assert(
  verified.wallet?.recentRecords?.some((record) => record.id === `wallet-tx-${txHash}`),
  "verified tx creates wallet record"
);

const followUp = await postJson("/api/v2/phase-one", {
  userId,
  text: "好了，继续"
});
assert(followUp.mobileTurn?.goalType === "prediction_market_research", "verified wallet follow-up enters Agent flow");
assert(followUp.wallet?.agent?.fundsStatus === "ready", "follow-up keeps ready wallet state");
assert(followUp.orchestration?.capability?.liveExecution?.enabled === false, "follow-up keeps live execution disabled");

const audit = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(userId)}&limit=20`);
const txAudit = audit.events?.find((event) => event.type === "wallet.tx_verified" && sameHex(event.txHash, txHash));
assert(txAudit?.moneyMoved === false, "wallet tx audit records no money movement");
assert(txAudit?.walletRecord?.id === `wallet-tx-${txHash}`, "wallet tx audit includes linked wallet record");

const memory = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(userId)}`);
assert(
  memory.memory?.wallet?.verifiedTransfers?.some((transfer) => sameHex(transfer.txHash, txHash)),
  "mobile memory records verified transfer"
);
assert(
  memory.memory?.wallet?.records?.some((record) => record.id === `wallet-tx-${txHash}`),
  "mobile memory records wallet journey"
);

const otherMemory = await getJson(`/api/v2/mobile/memory?userId=${encodeURIComponent(otherUserId)}`);
const otherAudit = await getJson(`/api/v2/mobile/audit?userId=${encodeURIComponent(otherUserId)}&limit=20`);
assert(
  !otherMemory.memory?.wallet?.verifiedTransfers?.some((transfer) => sameHex(transfer.txHash, txHash)),
  "other user memory cannot see verified tx"
);
assert(
  !otherAudit.events?.some((event) => sameHex(event.txHash, txHash)),
  "other user audit cannot see verified tx"
);

console.log(JSON.stringify({
  ok: true,
  mode: "mobile-device-hwallet-live",
  baseUrl: {
    configured: true,
    kind: baseUrlInfo.kind,
    protocol: baseUrlInfo.protocol
  },
  checks,
  summary: {
    walletBound: true,
    receiveAddressCount: receiveCard.addresses.length,
    verifiedFundsStatus: verified.wallet?.agent?.fundsStatus,
    followUpGoal: followUp.mobileTurn?.goalType,
    liveExecutionEnabled: Boolean(followUp.orchestration?.capability?.liveExecution?.enabled)
  }
}, null, 2));

function getDeviceBaseUrl() {
  return (
    process.env.MOBILE_DEVICE_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.AGENT_WALLET_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

function classifyBaseUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1") {
      return { valid: true, kind: "localhost", protocol: url.protocol.replace(":", "") };
    }
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return { valid: true, kind: "lan", protocol: url.protocol.replace(":", "") };
    }
    if (url.protocol === "https:") return { valid: true, kind: "https", protocol: "https" };
    return { valid: true, kind: "public-http", protocol: url.protocol.replace(":", "") };
  } catch {
    return { valid: false, kind: value ? "invalid" : "missing", protocol: "" };
  }
}

async function getJson(path) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${data.error || data.message || ""}`.trim());
  return data;
}

async function postJson(path, body) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${data.error || data.message || ""}`.trim());
  return data;
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MOBILE_DEVICE_SMOKE_TIMEOUT_MS || 15000));
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile device HWallet smoke failed: ${label}`);
  checks.push(label);
}

function sameHex(left, right) {
  return Boolean(left && right && String(left).toLowerCase() === String(right).toLowerCase());
}

async function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
