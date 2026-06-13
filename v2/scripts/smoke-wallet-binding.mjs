const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `wallet-binding-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const walletAChecksumCase = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const walletB = "0x2222222222222222222222222222222222222222";

const initialHome = await getJson(
  `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletA)}`
);
assert(initialHome.wallet?.address === walletA, "first wallet binds to user");
assert(initialHome.wallet?.lifecycle?.length === 4, "wallet lifecycle has four steps");
assert(
  initialHome.wallet?.lifecycle?.some((step) => step.id === "wallet" && step.status === "done"),
  "wallet lifecycle marks wallet bound"
);
assert(
  initialHome.wallet?.lifecycle?.some((step) => step.id === "assets" && ["active", "done"].includes(step.status)),
  "wallet lifecycle marks assets active or synced"
);

const rememberedWallet = await getJson(`/api/v2/mobile/wallet?userId=${encodeURIComponent(userId)}`);
assert(rememberedWallet.wallet?.address === walletA, "wallet endpoint remembers bound address without resending it");
assert(rememberedWallet.wallet?.lifecycle?.some((step) => step.id === "wallet" && step.status === "done"), "remembered wallet keeps lifecycle");

const checksumCaseWallet = await getJson(
  `/api/v2/mobile/wallet?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAChecksumCase)}`
);
assert(checksumCaseWallet.wallet?.address === walletAChecksumCase, "same wallet with checksum case is accepted");

const conflictHome = await getStatus(
  `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletB)}`
);
assert(conflictHome.status === 409, "home blocks replacing a bound wallet");
assert(conflictHome.data?.error === "wallet_address_conflict", "home returns wallet conflict code");

const conflictWallet = await getStatus(
  `/api/v2/mobile/wallet?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletB)}`
);
assert(conflictWallet.status === 409, "wallet endpoint blocks replacing a bound wallet");

const conflictRefresh = await postStatus("/api/v2/mobile/wallet/refresh", {
  userId,
  walletAddress: walletB
});
assert(conflictRefresh.status === 409, "wallet refresh blocks replacing a bound wallet");

const conflictChat = await postStatus("/api/v2/phase-one", {
  userId,
  walletAddress: walletB,
  text: "我要充值"
});
assert(conflictChat.status === 409, "agent chat blocks replacing a bound wallet");

const otherHome = await getJson(
  `/api/v2/mobile/home?userId=${encodeURIComponent(otherUserId)}&walletAddress=${encodeURIComponent(walletB)}`
);
assert(otherHome.wallet?.address === walletB, "another user can bind their own wallet");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  userId,
  checks: [
    "first bind",
    "lifecycle initialized",
    "remembered address",
    "checksum-case address accepted",
    "home conflict",
    "wallet conflict",
    "refresh conflict",
    "chat conflict",
    "other user isolated"
  ]
}, null, 2));

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return readJsonResponse(response, path);
}

async function getStatus(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data
  };
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

async function readJsonResponse(response, path) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.error || ""}`.trim());
  }
  return data;
}

function assert(condition, label) {
  if (!condition) throw new Error(`Wallet binding smoke failed: ${label}`);
}
