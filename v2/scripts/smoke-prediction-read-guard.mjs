import assert from "node:assert/strict";
import { guardPredictionReadRequest } from "../auth/prediction-read-guard.ts";

const originalRequirePrivy = process.env.AGENT_REQUIRE_PRIVY_TOKEN;
const originalRequireOwner = process.env.AGENT_REQUIRE_OWNER;
const originalRateLimit = process.env.PREDICTION_READ_RATE_LIMIT;
const originalRateWindow = process.env.PREDICTION_READ_RATE_WINDOW_MS;

const checks = [];

try {
  process.env.AGENT_REQUIRE_PRIVY_TOKEN = "true";
  process.env.AGENT_REQUIRE_OWNER = "";
  process.env.PREDICTION_READ_RATE_LIMIT = "2";
  process.env.PREDICTION_READ_RATE_WINDOW_MS = "60000";

  const unauthorized = await guardPredictionReadRequest(
    new Request("http://localhost/api/v2/world-cup/explore"),
    { route: "world-cup-explore" }
  );
  check(unauthorized.ok === false, "missing Privy token is rejected when token mode is enabled");
  if (!unauthorized.ok) {
    check(unauthorized.status === 401, "missing token returns 401");
    check(unauthorized.body.error === "Missing Privy access token", "missing token keeps stable auth error code");
    check(unauthorized.headers["cache-control"] === "no-store", "missing token response is not cached");
  }

  process.env.AGENT_REQUIRE_PRIVY_TOKEN = "";
  const request = () =>
    new Request("http://localhost/api/v2/prediction/detail?userId=prediction-read-guard-user&marketId=market-1", {
      headers: {
        "user-agent": "prediction-read-guard-smoke"
      }
    });

  const first = await guardPredictionReadRequest(request(), { route: "prediction-detail" });
  const second = await guardPredictionReadRequest(request(), { route: "prediction-detail" });
  const third = await guardPredictionReadRequest(request(), { route: "prediction-detail" });

  check(first.ok === true, "first read request is accepted");
  check(second.ok === true, "second read request is accepted");
  check(third.ok === false, "third read request is rate limited");
  if (first.ok) {
    check(first.headers["x-hwallet-read-scope"] === "prediction-market-readonly", "accepted response marks read-only scope");
    check(first.headers["x-ratelimit-limit"] === "2", "accepted response exposes configured limit");
  }
  if (!third.ok) {
    check(third.status === 429, "rate-limited response returns 429");
    check(third.body.error === "prediction_read_rate_limited", "rate-limited response keeps stable error code");
    check(Boolean(third.headers["retry-after"]), "rate-limited response exposes retry-after");
  }
} finally {
  restoreEnv("AGENT_REQUIRE_PRIVY_TOKEN", originalRequirePrivy);
  restoreEnv("AGENT_REQUIRE_OWNER", originalRequireOwner);
  restoreEnv("PREDICTION_READ_RATE_LIMIT", originalRateLimit);
  restoreEnv("PREDICTION_READ_RATE_WINDOW_MS", originalRateWindow);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checks
    },
    null,
    2
  )
);

function check(condition, label) {
  assert(condition, `prediction read guard smoke failed: ${label}`);
  checks.push(label);
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
