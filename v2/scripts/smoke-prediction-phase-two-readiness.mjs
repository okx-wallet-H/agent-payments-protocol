import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
const verifyMerge = String(scripts["verify:merge"] || "");

const okxClient = read("v2/execution/okx-outcomes-client.ts");
const detailView = read("v2/app/prediction-detail-view.ts");
const worldCupExplore = read("v2/app/world-cup-explore.ts");
const detailRoute = read("app/api/v2/prediction/detail/route.ts");
const worldCupRoute = read("app/api/v2/world-cup/explore/route.ts");
const predictionReadGuard = read("v2/auth/prediction-read-guard.ts");
const predictionReadGuardSmoke = read("v2/scripts/smoke-prediction-read-guard.mjs");
const mobileScreen = read("apps/mobile/src/V2AgentWalletScreen.tsx");
const mobileApi = read("apps/mobile/src/api.ts");
const integrationDoc = read("docs/OKX_OUTCOMES_READONLY_INTEGRATION.md");
const cleanupQueue = read("docs/PREDICTION_MARKET_CLEANUP_QUEUE.md");
const projectPlan = read("docs/PROJECT_EXECUTION_PLAN.md");

const checks = [];
function check(condition, message) {
  assert(condition, `prediction phase-two readiness failed: ${message}`);
  checks.push(message);
}

for (const scriptName of [
  "smoke:outcomes",
  "smoke:outcomes-market-catalog",
  "smoke:okx-outcomes-readonly-boundary",
  "smoke:agent-readonly-explanation",
  "smoke:prediction-detail-view",
  "smoke:prediction-detail-route",
  "smoke:mobile-prediction-market-ui",
  "smoke:prediction-read-guard",
  "smoke:prediction-market-archive",
  "smoke:execution-gates"
]) {
  check(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
  check(verifyMerge.includes(scriptName), `verify:merge includes ${scriptName}`);
}

check(
  typeof scripts["smoke:prediction-phase-two-readiness"] === "string",
  "package exposes prediction phase-two readiness smoke"
);
check(
  verifyMerge.includes("smoke:prediction-phase-two-readiness"),
  "verify:merge includes prediction phase-two readiness smoke"
);

for (const token of ["discoverWorldCupEvents", "getEventMarkets", "getMarket", "getTicker", "getCandles", "getOrderBook"]) {
  check(okxClient.includes(token), `OKX Outcomes client supports ${token}`);
}
for (const pathToken of [
  "/api/v5/predictions/events/search",
  "/api/v5/predictions/events",
  "/api/v5/predictions/markets",
  "/api/v5/market/ticker",
  "/api/v5/market/candles",
  "/api/v5/market/pm-books"
]) {
  check(okxClient.includes(pathToken), `OKX Outcomes client reads ${pathToken}`);
}
check(
  !/\b(placeOrder|submitOrder|createOrder|sendTransaction|writeContract|signTransaction|broadcast)\b/i.test(okxClient),
  "OKX Outcomes client does not expose live execution methods"
);

check(detailRoute.includes("getOkxOutcomeMarketData"), "prediction detail route reads OKX Outcomes market data");
check(detailRoute.includes("guardPredictionReadRequest"), "prediction detail route guards read access before provider reads");
check(detailRoute.includes("createPredictionDetailView"), "prediction detail route returns normalized detail view");
check(/includeOrderBook\s*:\s*true/.test(detailRoute), "prediction detail route requests order book data");
check(detailRoute.includes("providerStatus") && detailRoute.includes("credentialsBound"), "prediction detail route returns redacted provider status");
check(!/\bexport\s+async\s+function\s+POST\b/.test(detailRoute), "prediction detail route remains GET-only");

check(worldCupRoute.includes("listOkxWorldCupMarkets"), "explore route can read OKX market catalog");
check(worldCupRoute.includes("guardPredictionReadRequest"), "explore route guards read access before provider reads");
check(worldCupRoute.includes("createWorldCupExploreView"), "explore route returns app-facing explore view");
check(worldCupExplore.includes("credentialsBound") && worldCupExplore.includes("providerStatus"), "explore source carries redacted provider status");

check(predictionReadGuard.includes("resolvePhaseOneUser"), "prediction read guard reuses Privy user boundary");
check(predictionReadGuard.includes("PREDICTION_READ_RATE_LIMIT"), "prediction read guard exposes rate-limit tuning");
check(predictionReadGuard.includes("prediction_read_rate_limited"), "prediction read guard returns a friendly rate-limit error");
check(predictionReadGuard.includes("x-hwallet-read-scope"), "prediction read guard marks read-only scope headers");
check(predictionReadGuardSmoke.includes("missing Privy token is rejected"), "prediction read guard smoke checks auth rejection");
check(predictionReadGuardSmoke.includes("third read request is rate limited"), "prediction read guard smoke checks rate-limit rejection");

check(detailView.includes("readOnly: true"), "detail view marks readOnly true");
check(detailView.includes("liveExecutionClosed: true"), "detail view marks live execution closed");
check(detailView.includes("observe") && detailView.includes("simulate"), "detail view exposes observe and simulate only");
check(detailView.includes("shortenId") && detailView.includes("assetIdLabel"), "detail view redacts full outcome asset ids");
check(
  !/\b(buy|sell|swap|broadcast|place_order|signature|privateKey)\b/.test(JSON.stringify(detailView)),
  "detail view source avoids user-facing live-execution vocabulary"
);

for (const text of [
  "预测市场",
  "OKX Outcomes",
  "只读查询",
  "订单簿摘要",
  "API Key ·",
  "绑定入口预留",
  "观察",
  "模拟预览",
  "下单未开放"
]) {
  check(mobileScreen.includes(text), `mobile screen contains ${text}`);
}
check(mobileApi.includes("/api/v2/world-cup/explore"), "mobile API reads market explore endpoint");
check(mobileApi.includes("/api/v2/prediction/detail"), "mobile API reads prediction detail endpoint");

for (const text of [
  "read-only / 只读",
  "Simulation: simulation remains a dry-run preview only",
  "Forbidden Action List",
  "live prediction order placement",
  "transaction signing",
  "transaction broadcast",
  "Future Live Capability Gate"
]) {
  check(integrationDoc.includes(text), `OKX integration doc records ${text}`);
}

check(cleanupQueue.includes("archive/manual/prediction-market-preview"), "cleanup queue records archived preview code");
check(cleanupQueue.includes("Do Not Archive Yet"), "cleanup queue preserves migration hold list");
check(projectPlan.includes("OKX Onchain OS And Prediction Integration"), "project plan has prediction integration phase");
check(projectPlan.includes("read-only prediction detail view"), "project plan records read-only detail view");
check(projectPlan.includes("limited to observe/simulate"), "project plan records observe/simulate action limit");
check(projectPlan.includes("Real execution remains gated"), "project plan keeps live execution gated");

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: "prediction-market-phase-two",
      boundary: {
        data: "OKX Outcomes read-only market data",
        app: "mobile explore/detail UI",
        agent: "observe and dry-run explanation",
        closed: ["live order", "signing", "swap", "broadcast"]
      },
      checks
    },
    null,
    2
  )
);
