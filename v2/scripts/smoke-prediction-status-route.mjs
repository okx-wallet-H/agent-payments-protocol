import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const route = read("app/api/v2/prediction/status/route.ts");
const guard = read("v2/auth/prediction-read-guard.ts");
const mobileApi = read("apps/mobile/src/api.ts");
const mobileTypes = read("apps/mobile/src/types.ts");
const mobileScreen = read("apps/mobile/src/V2AgentWalletScreen.tsx");

const checks = [];
function check(condition, message) {
  assert(condition, `prediction status route smoke failed: ${message}`);
  checks.push(message);
}

function includesAll(label, content, tokens) {
  for (const token of tokens) {
    check(content.includes(token), `${label} includes ${token}`);
  }
}

includesAll("status route", route, [
  "guardPredictionReadRequest",
  "hasOkxOutcomesCredentials",
  'route: "prediction-status"',
  "prediction_market_status",
  "providerStatus",
  "credentialsBound",
  "readOnly: true",
  "liveExecutionClosed: true",
  "apiKeyBinding",
  "appCollectionEnabled: false",
  'storage: "server-side-only"',
  "queryCapabilities",
  "operationCapabilities",
  "order_closed"
]);
check(/\bexport\s+async\s+function\s+GET\b/.test(route), "status route exposes GET");
check(!/\bexport\s+async\s+function\s+POST\b/.test(route), "status route remains GET-only");

for (const forbidden of [
  "\\bsignTransaction\\b",
  "\\bbroadcast\\b",
  "\\bsubmitOrder\\b",
  "\\bplaceOrder\\b",
  "\\bcreateOrder\\b",
  "\\bsendTransaction\\b",
  "\\bwriteContract\\b",
  "\\bprivateKey\\b",
  "\\bapiSecret\\b",
  "\\bpassphrase\\b",
  "OK-ACCESS-KEY",
  "OK-ACCESS-PASSPHRASE"
]) {
  check(!new RegExp(forbidden, "i").test(route), `status route excludes live/secret token: ${forbidden}`);
}

includesAll("prediction read guard", guard, ['"prediction-status"', "x-hwallet-read-scope"]);
includesAll("mobile API", mobileApi, [
  "getPredictionStatus(): Promise<V2PredictionStatusResponse>",
  "/api/v2/prediction/status"
]);
includesAll("mobile type", mobileTypes, [
  "V2PredictionStatusResponse",
  "prediction_market_status",
  "appCollectionEnabled: false",
  'storage: "server-side-only"',
  '"order_closed"'
]);
includesAll("mobile screen", mobileScreen, [
  "getPredictionStatus",
  "predictionStatus",
  "API 状态",
  "API Key",
  "第二阶段不在 App 内收集或保存用户 API Key",
  "真实下单关闭"
]);

console.log(
  JSON.stringify(
    {
      ok: true,
      scope: "prediction-status-readonly",
      route: "app/api/v2/prediction/status/route.ts",
      checks
    },
    null,
    2
  )
);
