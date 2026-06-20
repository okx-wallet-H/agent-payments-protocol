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
const predictionStatusRoute = read("app/api/v2/prediction/status/route.ts");
const predictionExploreRoute = read("app/api/v2/prediction/explore/route.ts");
const worldCupRoute = read("app/api/v2/world-cup/explore/route.ts");
const predictionReadGuard = read("v2/auth/prediction-read-guard.ts");
const predictionReadGuardSmoke = read("v2/scripts/smoke-prediction-read-guard.mjs");
const mobileScreen = read("apps/mobile/src/V2AgentWalletScreen.tsx");
const mobileApi = read("apps/mobile/src/api.ts");
const integrationDoc = read("docs/OKX_OUTCOMES_READONLY_INTEGRATION.md");
const liveFieldMappingDoc = read("docs/OKX_OUTCOMES_LIVE_FIELD_MAPPING.md");
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
  "smoke:okx-outcomes-simulation-preview",
  "smoke:okx-outcomes-readonly-boundary",
  "smoke:okx-outcomes-live-field-mapping",
  "smoke:okx-outcomes-live-schema",
  "smoke:agent-readonly-explanation",
  "smoke:prediction-detail-view",
  "smoke:prediction-detail-route",
  "smoke:prediction-status-route",
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
check(detailRoute.includes("okx_outcomes_not_configured") && detailRoute.includes("okx_outcomes_unavailable"), "prediction detail route exposes explicit unavailable states");
check(detailRoute.includes("No sample detail was returned.") && !detailRoute.includes("using sample detail"), "prediction detail route does not silently return sample detail for live failures");
check(/includeOrderBook\s*:\s*true/.test(detailRoute), "prediction detail route requests order book data");
check(/includeCandles\s*:\s*true/.test(detailRoute), "prediction detail route requests candle data for trend summary");
check(detailRoute.includes("providerStatus") && detailRoute.includes("credentialsBound"), "prediction detail route returns redacted provider status");
check(!/\bexport\s+async\s+function\s+POST\b/.test(detailRoute), "prediction detail route remains GET-only");

check(predictionStatusRoute.includes('route: "prediction-status"'), "prediction status route uses its own read guard scope");
check(predictionStatusRoute.includes("prediction_market_status"), "prediction status route returns app-facing status type");
check(predictionStatusRoute.includes("apiKeyBinding"), "prediction status route returns API key binding placeholder");
check(predictionStatusRoute.includes("appCollectionEnabled: false"), "prediction status route prevents App-side API key collection");
check(predictionStatusRoute.includes('storage: "server-side-only"'), "prediction status route keeps credential storage server-side only");
check(predictionStatusRoute.includes("liveExecutionClosed: true"), "prediction status route keeps live execution closed");
check(predictionStatusRoute.includes("order_closed"), "prediction status route exposes disabled order operation");
check(!/\bexport\s+async\s+function\s+POST\b/.test(predictionStatusRoute), "prediction status route remains GET-only");

check(predictionExploreRoute.includes("readPredictionExploreData"), "generic prediction explore route reads shared market data");
check(predictionExploreRoute.includes('route: "prediction-explore"'), "generic prediction explore route uses its own read guard scope");
check(predictionExploreRoute.includes("createWorldCupExploreView"), "generic prediction explore route returns app-facing explore view");
check(worldCupRoute.includes("readPredictionExploreData"), "legacy world-cup explore route delegates to shared market data");
check(worldCupRoute.includes('route: "world-cup-explore"'), "legacy world-cup explore route keeps compatibility guard scope");
check(worldCupExplore.includes("credentialsBound") && worldCupExplore.includes("providerStatus"), "explore source carries redacted provider status");
check(worldCupExplore.includes("marketRef: createExploreMarketRef"), "explore cards use sanitized market references");
check(worldCupExplore.includes("readOnly: true") && worldCupExplore.includes("liveExecutionClosed: true"), "explore market refs stay read-only");
check(worldCupExplore.includes("assetIdLabel") && worldCupExplore.includes("shortenId"), "explore options redact outcome asset ids");
check(!worldCupExplore.includes("market,\n    options"), "explore cards do not return raw market snapshots");

check(predictionReadGuard.includes("resolvePhaseOneUser"), "prediction read guard reuses Privy user boundary");
check(predictionReadGuard.includes("PREDICTION_READ_RATE_LIMIT"), "prediction read guard exposes rate-limit tuning");
check(predictionReadGuard.includes("prediction_read_rate_limited"), "prediction read guard returns a friendly rate-limit error");
check(predictionReadGuard.includes("x-hwallet-read-scope"), "prediction read guard marks read-only scope headers");
check(predictionReadGuardSmoke.includes("missing Privy token is rejected"), "prediction read guard smoke checks auth rejection");
check(predictionReadGuardSmoke.includes("third read request is rate limited"), "prediction read guard smoke checks rate-limit rejection");

check(detailView.includes("readOnly: true"), "detail view marks readOnly true");
check(detailView.includes("liveExecutionClosed: true"), "detail view marks live execution closed");
check(
  detailView.includes("order_closed") &&
    detailView.includes("local_record") &&
    detailView.includes("enabled: false") &&
    detailView.includes("disabledReason"),
  "detail view exposes server action model with disabled order placeholder"
);
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
  "API 状态",
  "绑定入口预留",
  "第二阶段不在 App 内收集或保存用户 API Key",
  "观察",
  "模拟预览",
  "加入跟踪",
  "生成策略",
  "下单未开放"
]) {
  check(mobileScreen.includes(text), `mobile screen contains ${text}`);
}
check(mobileApi.includes("/api/v2/prediction/explore"), "mobile API reads generic prediction market explore endpoint");
check(mobileApi.includes("/api/v2/prediction/detail"), "mobile API reads prediction detail endpoint");
check(mobileApi.includes("/api/v2/prediction/status"), "mobile API reads prediction status endpoint");

for (const text of [
  "read-only / 只读",
  "Simulation: OKX Outcomes simulation is a local/contract-style dry-run preview",
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
check(projectPlan.includes("observe/simulate/local-record/closed-order model"), "project plan records server action model");
check(projectPlan.includes("Real execution remains gated"), "project plan keeps live execution gated");
check(
  integrationDoc.includes("outcomes.order.preview") && integrationDoc.includes("moneyMoved: false"),
  "OKX integration doc records dry-run preview safety fields"
);
check(
  read("v2/execution/okx-outcomes-preview.ts").includes("outcomes.order.preview") &&
    read("v2/execution/okx-outcomes-preview.ts").includes("moneyMoved: false"),
  "OKX Outcomes preview helper keeps dry-run and money movement boundary"
);
check(liveFieldMappingDoc.includes("Do not use `marketId` as the `instId`"), "live field mapping doc protects outcome instId usage");
check(liveFieldMappingDoc.includes("Settlement And Final Result"), "live field mapping doc records settlement gap");
check(liveFieldMappingDoc.includes("not yet consumed by the App"), "live field mapping doc keeps unproven settlement hidden");
check(liveFieldMappingDoc.includes("YES and NO candle queries using outcome asset ids as `instId`"), "live field mapping doc requires live candle sample");
check(liveFieldMappingDoc.includes("smoke:okx-outcomes-live-schema"), "live field mapping doc exposes opt-in live schema smoke");
check(liveFieldMappingDoc.includes("redacted schema evidence only"), "live field mapping doc keeps live schema output redacted");

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
