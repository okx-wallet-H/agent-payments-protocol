const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `auth-smoke-user-${Date.now()}`;
const checks = [];

const invalidBearer = await fetch(`${baseUrl}/api/v2/mobile/home`, {
  headers: {
    authorization: "Bearer invalid-token-for-smoke-test"
  }
});

assert(invalidBearer.status === 401, "invalid bearer token is rejected");

const localFallback = await fetch(`${baseUrl}/api/v2/mobile/home?userId=${encodeURIComponent(userId)}`);
const localFallbackData = await localFallback.json().catch(() => ({}));

assert(localFallback.ok, "local explicit userId fallback works in development");
assert(localFallbackData.home?.type === "mobile_home_view", "local fallback returns mobile home");

const actionWithoutMarket = await fetch(`${baseUrl}/api/v2/phase-one/actions`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: "Bearer invalid-token-for-smoke-test"
  },
  body: JSON.stringify({
    action: "track",
    userId
  })
});

assert(actionWithoutMarket.status === 400, "action validation runs before auth when market is missing");

const actionInvalidBearer = await fetch(`${baseUrl}/api/v2/phase-one/actions`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: "Bearer invalid-token-for-smoke-test"
  },
  body: JSON.stringify({
    action: "track",
    market: {
      provider: "polymarket-plugin",
      chainId: 137,
      marketId: "auth-smoke-market",
      question: "Auth smoke market",
      acceptingOrders: true,
      yesPrice: 0.1
    },
    userId
  })
});

assert(actionInvalidBearer.status === 401, "action with invalid bearer token is rejected");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  userId,
  checks
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Auth smoke check failed: ${label}`);
  checks.push(label);
}
