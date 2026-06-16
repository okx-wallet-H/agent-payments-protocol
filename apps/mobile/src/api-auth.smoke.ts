import { ApiRequestError, createApi } from "./api";

const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; init?: RequestInit }> = [];
let nextStatus = 200;
let nextBody: unknown = {
  home: {
    type: "mobile_home_view"
  }
};

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  requests.push({
    url: String(input),
    init
  });

  return new Response(JSON.stringify(nextBody), {
    status: nextStatus,
    headers: {
      "content-type": "application/json"
    }
  });
}) as typeof fetch;

try {
  const token = "privy-access-token-for-smoke";
  const authedApi = createApi("https://app.example", async () => token);

  await authedApi.getV2Home("api-auth-user", "0x59029AD72744Ea033a4Ccb261Ec79569e158209e");

  const authedRequest = requests.at(-1);
  assert(Boolean(authedRequest), "authed request is captured");
  const authedHeaders = readHeaders(authedRequest?.init?.headers);
  assert(authedHeaders.authorization === `Bearer ${token}`, "mobile API attaches Privy Bearer token");
  assert(!authedRequest?.url.includes(token), "mobile API never puts access token in URL");

  await authedApi.submitV2DeviceEvidence({
    userId: "api-auth-user",
    walletAddress: "0x59029AD72744Ea033a4Ccb261Ec79569e158209e",
    environment: {
      platform: "ios",
      buildChannel: "preview",
      apiBaseUrl: "https://app.example",
      appVersion: "0.1.0",
      buildNumber: "9"
    },
    checks: {
      appOpensWithoutCrash: true,
      hWalletVisible: true,
      receiveAddressVisible: true,
      copyFeedbackVisible: true,
      noWrongUserDataExposure: true,
      liveExecutionClosed: true
    },
    artifacts: [
      {
        label: "h-wallet-copy-feedback",
        redacted: true
      }
    ]
  });

  const evidenceRequest = requests.at(-1);
  assert(evidenceRequest?.url === "https://app.example/api/v2/mobile/device-evidence", "mobile API posts device evidence path");
  assert(evidenceRequest?.init?.method === "POST", "mobile API submits device evidence with POST");
  const evidenceHeaders = readHeaders(evidenceRequest?.init?.headers);
  assert(evidenceHeaders.authorization === `Bearer ${token}`, "mobile API attaches Privy token to device evidence");
  assert(!evidenceRequest?.url.includes(token), "device evidence URL does not expose access token");

  requests.length = 0;
  const anonymousApi = createApi("https://app.example", async () => undefined);

  await anonymousApi.getV2Home("api-auth-user", "0x59029AD72744Ea033a4Ccb261Ec79569e158209e");

  const anonymousHeaders = readHeaders(requests.at(-1)?.init?.headers);
  assert(!anonymousHeaders.authorization, "mobile API omits Authorization header when no token is available");

  nextStatus = 401;
  nextBody = {
    error: "Missing Privy access token"
  };

  let caughtError: unknown;
  try {
    await anonymousApi.getV2Home("api-auth-user", "0x59029AD72744Ea033a4Ccb261Ec79569e158209e");
  } catch (error) {
    caughtError = error;
  }

  assert(caughtError instanceof ApiRequestError, "mobile API wraps auth failures in ApiRequestError");
  assert((caughtError as ApiRequestError).status === 401, "mobile API preserves auth failure status");
  assert((caughtError as ApiRequestError).code === "Missing Privy access token", "mobile API preserves auth failure code");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "mobile API attaches Privy Bearer token",
      "mobile API omits Authorization when token is unavailable",
      "mobile API preserves auth errors without exposing tokens"
    ]
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}

function readHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key.toLowerCase(), value]));
  }
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
}

function assert(condition: unknown, label: string) {
  if (!condition) throw new Error(`Mobile API auth smoke failed: ${label}`);
}
