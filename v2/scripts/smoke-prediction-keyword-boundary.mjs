import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const files = {
  marketsRoute: read("app/api/prediction/markets/route.ts"),
  runRoute: read("app/api/agents/[id]/run/route.ts"),
  agentsRoute: read("app/api/agents/route.ts"),
  agentChat: read("lib/agent-chat.ts"),
  agentRunner: read("lib/agent-runner.ts"),
  defaults: read("lib/defaults.ts"),
  onchainRouter: read("lib/onchainos-router.ts"),
  polymarket: read("lib/polymarket.ts"),
  prediction: read("lib/prediction.ts"),
  mobileApi: read("apps/mobile/src/api.ts")
};

const checks = [];

check(files.onchainRouter.includes("requirePredictionKeyword(keyword)"), "router requires an explicit prediction keyword");
check(files.onchainRouter.includes("normalizePredictionKeyword"), "router exposes keyword normalizer");
reject(files.onchainRouter, 'keyword = "World Cup"', "router has no hidden World Cup keyword default");

check(files.polymarket.includes("prediction keyword is required"), "polymarket client rejects blank keywords");
reject(files.polymarket, 'keyword = "World Cup"', "polymarket client has no hidden World Cup keyword default");

check(files.marketsRoute.includes("normalizePredictionKeyword"), "markets route normalizes caller keyword");
check(files.marketsRoute.includes("keyword is required"), "markets route reports missing keyword");
check(files.marketsRoute.includes("{ status: 400 }"), "markets route rejects missing keyword with 400");
reject(files.marketsRoute, '|| "World Cup"', "markets route does not silently fallback to World Cup");

check(files.runRoute.includes("normalizePredictionKeyword"), "agent run route normalizes caller keyword");
check(files.runRoute.includes('jsonError("keyword is required", 400)'), "agent run route rejects missing keyword");
reject(files.runRoute, 'body.keyword || "World Cup"', "agent run route does not silently fallback to World Cup");

check(files.agentRunner.includes("keyword: string"), "agent runner requires keyword in its signature");
check(files.agentRunner.includes("market: selectedMarket.slug || selectedMarket.id"), "agent runner uses observed selected market id");
reject(files.agentRunner, 'keyword = "World Cup"', "agent runner has no World Cup keyword default");
reject(files.agentRunner, "polymarket-world-cup-2026", "agent runner has no polymarket World Cup market fallback");
reject(files.agentRunner, "okx-world-cup-2026", "agent runner has no OKX World Cup market fallback");
reject(files.agentRunner, "世界杯相关市场", "agent runner has no World Cup narrative fallback");

check(files.prediction.includes("prediction-market-observed"), "prediction intent has generic observed-market fallback");
check(files.prediction.includes("observed market probability"), "prediction reasoning uses observed probability wording");
reject(files.prediction, "polymarket-world-cup-2026", "prediction intent has no polymarket World Cup fallback");
reject(files.prediction, "okx-world-cup-2026", "prediction intent has no OKX World Cup fallback");
reject(files.prediction, "World Cup prediction", "prediction intent has no World Cup thesis fallback");
reject(files.prediction, "placeholder probability", "prediction intent no longer claims placeholder probability");

check(files.mobileApi.includes("market: market.slug || market.id"), "mobile client uses selected market id when creating an intent");
check(files.mobileApi.includes('market: "prediction-market-observed"'), "mobile client has generic observed-market fallback");
reject(files.mobileApi, 'keyword = "World Cup"', "mobile client has no run/list keyword default");
reject(files.mobileApi, "polymarket-world-cup-2026", "mobile client has no polymarket World Cup market fallback");
reject(files.mobileApi, "okx-world-cup-2026", "mobile client has no OKX World Cup market fallback");

check(files.defaults.includes("prediction-market-observed"), "default policy allowlist uses generic observed market");
reject(files.defaults, "polymarket-world-cup-2026", "default policy has no polymarket World Cup allowlist");
reject(files.defaults, "okx-world-cup-2026", "default policy has no OKX World Cup allowlist");

check(files.agentChat.includes("runPredictionAgent(agent, amountOkb, content)"), "chat runner passes user content as keyword");
check(files.agentChat.includes("keyword: content.trim()"), "chat decision records explicit user keyword");
reject(files.agentChat, 'runPredictionAgent(agent, amountOkb, "World Cup")', "agent chat has no World Cup runner default");
reject(files.agentChat, "帮我看看世界杯机会", "agent chat does not suggest World Cup as the default market");

reject(files.agentsRoute, "World Cup Prediction Agent", "agent creation has generic default name");
reject(files.agentsRoute, "World Cup markets", "agent creation has generic strategy profile");

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

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function check(condition, label) {
  if (!condition) throw new Error(`prediction keyword boundary smoke failed: ${label}`);
  checks.push(label);
}

function reject(source, needle, label) {
  check(!source.includes(needle), label);
}
