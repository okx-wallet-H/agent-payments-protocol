import { readFile } from "node:fs/promises";

await loadLocalEnv();

const baseUrl = readBaseUrl();
const checks = [];
const userId = `staging-auth-surface-${Date.now()}`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";

const auth = await getJson("/api/system/auth");
check(auth.accessControl?.requireOwner === true, "owner guard is enabled");
check(auth.accessControl?.requirePrivyToken === true, "Privy access token is required");
check(auth.accessControl?.enforcement === "privy_access_token", "auth enforcement is Privy token based");

await expectUnauthorized("GET mobile home", `/api/v2/mobile/home?${params({ userId, walletAddress })}`);
await expectUnauthorized("GET mobile wallet", `/api/v2/mobile/wallet?${params({ userId, walletAddress })}`);
await expectUnauthorized("GET mobile memory", `/api/v2/mobile/memory?${params({ userId })}`);
await expectUnauthorized("GET mobile audit", `/api/v2/mobile/audit?${params({ userId, limit: "5" })}`);
await expectUnauthorized("GET phase-one shell", `/api/v2/phase-one?${params({ userId, walletAddress })}`);
await expectUnauthorized("GET phase-one records", `/api/v2/phase-one/records?${params({ userId })}`);
await expectUnauthorized("GET phase-one tracking", `/api/v2/phase-one/tracking?${params({ userId })}`);
await expectUnauthorized("GET phase-one strategies", `/api/v2/phase-one/strategies?${params({ userId })}`);
await expectUnauthorized("POST phase-one chat", "/api/v2/phase-one", {
  method: "POST",
  body: {
    userId,
    walletAddress,
    text: "我要充值"
  }
});
await expectUnauthorized("POST wallet refresh", "/api/v2/mobile/wallet/refresh", {
  method: "POST",
  body: {
    userId,
    walletAddress
  }
});
await expectUnauthorized("POST wallet tx verify", "/api/v2/mobile/wallet/verify-tx", {
  method: "POST",
  body: {
    userId,
    walletAddress,
    txHash
  }
});
await expectUnauthorized("POST phase-one action", "/api/v2/phase-one/actions", {
  method: "POST",
  body: {
    userId,
    action: "track",
    market: {
      provider: "polymarket-plugin",
      chainId: 196,
      marketId: "staging-auth-surface-market",
      question: "Staging auth surface smoke market",
      acceptingOrders: true,
      yesPrice: 0.5
    }
  }
});

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checks,
  summary: {
    protectedEndpoints: checks.filter((item) => item.includes("rejects missing Privy access token")).length,
    enforcement: auth.accessControl?.enforcement
  }
}, null, 2));

function readBaseUrl() {
  const value = process.env.STAGING_API_BASE_URL ||
    process.env.AGENT_WALLET_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "";
  if (!value) {
    throw new Error("STAGING_API_BASE_URL, AGENT_WALLET_BASE_URL, or EXPO_PUBLIC_API_BASE_URL is required.");
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && process.env.ALLOW_INSECURE_STAGING_SERVER !== "true") {
    throw new Error("Staging auth surface requires HTTPS. Set ALLOW_INSECURE_STAGING_SERVER=true only for temporary LAN tests.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));
  check(response.ok, "auth gate endpoint responds with 2xx");
  return data;
}

async function expectUnauthorized(label, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  check(response.status === 401, `${label} rejects missing Privy access token`);
  check(data?.error === "Missing Privy access token", `${label} returns missing-token error`);
}

function params(input) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  return search.toString();
}

function check(condition, label) {
  if (!condition) throw new Error(`Staging auth surface smoke failed: ${label}`);
  checks.push(label);
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
