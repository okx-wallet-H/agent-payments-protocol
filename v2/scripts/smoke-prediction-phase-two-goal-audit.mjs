import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
const verifyMerge = String(scripts["verify:merge"] || "");

const files = {
  phaseReadiness: read("docs/PREDICTION_MARKET_PHASE_TWO_READINESS.md"),
  integrationDoc: read("docs/OKX_OUTCOMES_READONLY_INTEGRATION.md"),
  liveFieldMapping: read("docs/OKX_OUTCOMES_LIVE_FIELD_MAPPING.md"),
  cleanupQueue: read("docs/PREDICTION_MARKET_CLEANUP_QUEUE.md"),
  projectPlan: read("docs/PROJECT_EXECUTION_PLAN.md"),
  dispatchMatrix: read("docs/HWALLET_SUBTASK_DISPATCH_MATRIX.md"),
  taskWorkflow: read("docs/TASK_REVIEW_WORKFLOW.md"),
  okxClient: read("v2/execution/okx-outcomes-client.ts"),
  okxPreview: read("v2/execution/okx-outcomes-preview.ts"),
  predictionExploreData: read("v2/app/prediction-explore-data.ts"),
  predictionExploreRoute: read("app/api/v2/prediction/explore/route.ts"),
  exploreRoute: read("app/api/v2/world-cup/explore/route.ts"),
  detailRoute: read("app/api/v2/prediction/detail/route.ts"),
  exploreView: read("v2/app/world-cup-explore.ts"),
  detailView: read("v2/app/prediction-detail-view.ts"),
  mobileScreen: read("apps/mobile/src/V2AgentWalletScreen.tsx"),
  mobileTypes: read("apps/mobile/src/types.ts"),
  mobileApi: read("apps/mobile/src/api.ts"),
  executionGateSmoke: read("v2/scripts/smoke-execution-gates.mjs"),
  archiveSmoke: read("v2/scripts/smoke-prediction-market-archive.mjs"),
  mobilePredictionSmoke: read("v2/scripts/smoke-mobile-prediction-market-ui.mjs")
};

const checks = [];
function check(condition, message) {
  assert(condition, `prediction phase-two goal audit failed: ${message}`);
  checks.push(message);
}

function includesAll(label, content, tokens) {
  for (const token of tokens) {
    check(content.includes(token), `${label} includes ${token}`);
  }
}

function excludesAny(label, content, tokens) {
  for (const token of tokens) {
    check(!content.includes(token), `${label} excludes ${token}`);
  }
}

for (const scriptName of [
  "smoke:prediction-phase-two-goal-audit",
  "smoke:prediction-phase-two-readiness",
  "smoke:outcomes",
  "smoke:outcomes-market-catalog",
  "smoke:prediction-detail-view",
  "smoke:prediction-detail-route",
  "smoke:mobile-prediction-market-ui",
  "smoke:okx-outcomes-readonly-boundary",
  "smoke:okx-outcomes-live-field-mapping",
  "smoke:okx-outcomes-simulation-preview",
  "smoke:prediction-market-archive",
  "smoke:execution-gates",
  "smoke:subtask-dispatch",
  "smoke:task-review-workflow"
]) {
  check(typeof scripts[scriptName] === "string", `package script exists: ${scriptName}`);
  check(verifyMerge.includes(scriptName), `verify:merge includes ${scriptName}`);
}

includesAll("OKX Outcomes client", files.okxClient, [
  "discoverWorldCupEvents",
  "getEventMarkets",
  "getMarket",
  "getTicker",
  "getCandles",
  "getOrderBook",
  "/api/v5/predictions/events/search",
  "/api/v5/predictions/events",
  "/api/v5/predictions/markets",
  "/api/v5/market/ticker",
  "/api/v5/market/candles",
  "/api/v5/market/pm-books"
]);
excludesAny("OKX Outcomes client", files.okxClient, [
  "placeOrder",
  "submitOrder",
  "createOrder",
  "sendTransaction",
  "writeContract",
  "signTransaction",
  "broadcast"
]);

includesAll("prediction explore data", files.predictionExploreData, [
  "readPredictionExploreData",
  "listOkxWorldCupMarkets",
  "capturePredictionMarketSnapshotsSafely"
]);
includesAll("generic explore route", files.predictionExploreRoute, [
  "guardPredictionReadRequest",
  "prediction-explore",
  "readPredictionExploreData",
  "createWorldCupExploreView"
]);
includesAll("legacy explore route", files.exploreRoute, [
  "world-cup-explore",
  "readPredictionExploreData",
  "createWorldCupExploreView"
]);
includesAll("detail route", files.detailRoute, [
  "guardPredictionReadRequest",
  "getOkxOutcomeMarketData",
  "includeOrderBook: true",
  "createPredictionDetailView",
  "apiKeyBindingLabel",
  "liveExecutionClosed: true"
]);
check(!/\bexport\s+async\s+function\s+POST\b/.test(files.detailRoute), "prediction detail route remains GET-only");

includesAll("explore DTO", files.exploreView, [
  "marketRef: createExploreMarketRef",
  "readOnly: true",
  "liveExecutionClosed: true",
  "assetIdLabel",
  "shortenId"
]);
check(!files.exploreView.includes("market,\n    options"), "explore DTO does not return raw market snapshots");

includesAll("detail view", files.detailView, [
  "readOnly: true",
  "liveExecutionClosed: true",
  "order_closed",
  "enabled: false",
  "disabledReason",
  "shortenId",
  "assetIdLabel",
  "PredictionDetailTrendSummary",
  "createTrendSummary",
  "不会下单、签名或广播交易"
]);
for (const forbidden of ["privateKey", "seed phrase", "API_SECRET", "OKX_SECRET", "submitOrder"]) {
  check(!files.detailView.includes(forbidden), `detail view excludes credential/execution token: ${forbidden}`);
}

includesAll("mobile prediction market UI", files.mobileScreen, [
  "预测市场",
  "OKX Outcomes 只读查询",
  "订单簿摘要",
  "当前能力",
  "走势摘要",
  "API Key ·",
  "绑定入口预留",
  "不在本机保存密钥",
  "观察",
  "模拟预览",
  "加入跟踪",
  "生成策略",
  "下单未开放",
  "真实下单关闭"
]);
includesAll("mobile prediction actions", files.mobileTypes, [
  '"observe"',
  '"simulate"',
  '"track"',
  '"build_strategy"',
  '"order_closed"'
]);
includesAll("mobile prediction APIs", files.mobileApi, [
  "/api/v2/prediction/explore",
  "/api/v2/prediction/detail"
]);
includesAll("mobile prediction smoke", files.mobilePredictionSmoke, [
  "sanitized marketRef",
  "read-only trend summary",
  "order_closed",
  "predictionApiKeySlot} disabled",
  "不在本机保存密钥"
]);

includesAll("phase-two readiness doc", files.phaseReadiness, [
  "query, display, observe, and simulate",
  "Live order",
  "API Key binding",
  "Placeholder only",
  "Legacy preview cleanup"
]);
includesAll("OKX readonly integration doc", files.integrationDoc, [
  "read-only / 只读",
  "observe/simulate",
  "redacted `assetIdLabel`",
  "full outcome asset ids are internal market references",
  "Forbidden Action List",
  "Future Live Capability Gate",
  "allowlist",
  "production policy",
  "execution preview",
  "confirm code",
  "audit trail",
  "monitoring"
]);
includesAll("live field mapping doc", files.liveFieldMapping, [
  "Do not use `marketId` as the `instId`",
  "Settlement And Final Result",
  "not yet consumed by the App",
  "live-sample task is still read-only"
]);
includesAll("simulation preview", files.okxPreview, [
  "outcomes.order.preview",
  "dry_run_only",
  "moneyMoved: false"
]);
includesAll("execution gate smoke", files.executionGateSmoke, [
  "broadcast",
  "AGENT_WALLET_REAL_EXECUTION",
  "POLYMARKET_TRADING_API_ENABLED",
  "canBroadcastTransactions === false"
]);
includesAll("archive cleanup", files.cleanupQueue, [
  "archive/manual/prediction-market-preview",
  "Archived on 2026-06-18",
  "Do Not Archive Yet"
]);
includesAll("archive smoke", files.archiveSmoke, [
  "active app/api/docs tree does not reference archived preview files",
  "archive/manual/prediction-market-preview"
]);
includesAll("subtask workflow", files.dispatchMatrix, [
  "Only the controller may stage files",
  "at most three active helper packets",
  "The controller must rerun the relevant smoke",
  "approve, return for fixes, split, or block waiting for owner"
]);
includesAll("task review workflow", files.taskWorkflow, [
  "## Flow",
  "1. **Claim**",
  "6. **Review**",
  "7. **Merge**",
  "npm run smoke:subtask-dispatch",
  "npm run smoke:task-review-workflow",
  "npm run verify:merge"
]);
includesAll("project plan", files.projectPlan, [
  "OKX Onchain OS And Prediction Integration",
  "read-only prediction detail view",
  "observe/simulate/local-record/closed-order model",
  "Real execution remains gated"
]);

const reviewedFiles = Object.entries(files).filter(([name]) => !["packageJson"].includes(name)).length;

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: "prediction-market-phase-two-goal-audit",
      reviewedFiles,
      requirements: {
        apiConnectedReadOnly: true,
        appFrontendDisplay: true,
        orderPlacementPlaceholderOnly: true,
        apiKeyBindingSlotOnly: true,
        subtaskControllerAuditWorkflow: true,
        archiveCleanupGuard: true,
        verifyMergeGate: true
      },
      closedCapabilities: ["live_order", "signing", "swap", "broadcast"],
      checks
    },
    null,
    2
  )
);
