import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createBusinessGoal, createPredictionResearchPlan } from "../agent/business-agent.ts";
import { createSimulationCard } from "../agent/simulation-card.ts";
import {
  createOkxOutcomesDryRunPlan,
  executeOkxOutcomesDryRunPreview
} from "../execution/okx-outcomes-preview.ts";

const repoRoot = process.cwd();
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "okx-world-cup-2026",
  marketId: "okx-worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  status: "active",
  marketType: "binary",
  yesAssetId: "yes-asset-redacted",
  noAssetId: "no-asset-redacted",
  yesPrice: 0.17,
  noPrice: 0.83,
  acceptingOrders: true,
  liquidity: 4210,
  volume24h: 988
};

const goal = createBusinessGoal("先模拟一下", "prediction_market_dry_run");
const basePlan = createPredictionResearchPlan(goal, market);
assert.equal(basePlan.provider, "okx-outcomes", "research plan keeps OKX provider");

const dryRunPlan = createOkxOutcomesDryRunPlan({
  basePlan,
  amountUsd: 3,
  limitPrice: market.yesPrice
});
assert.equal(dryRunPlan.provider, "okx-outcomes", "dry-run plan uses OKX Outcomes provider");
assert.equal(dryRunPlan.mode, "dry_run", "dry-run plan stays dry-run");
assert.equal(dryRunPlan.side, "yes", "dry-run plan previews YES side");

const result = executeOkxOutcomesDryRunPreview(dryRunPlan);
assert.equal(result.status, "dry_run_completed", "OKX preview completes locally");
assert(!result.txHash, "OKX preview never returns a transaction hash");

const raw = result.raw;
assert.equal(raw.provider, "okx-outcomes", "raw result keeps OKX provider");
assert.equal(raw.route, "outcomes.order.preview", "raw result keeps OKX preview route");
assert.equal(raw.safety, "dry_run_only", "raw result is dry-run only");
assert.equal(raw.liveExecutionEnabled, false, "live execution remains disabled");
assert.equal(raw.moneyMoved, false, "OKX preview cannot move money");
assert.equal(raw.externalCall, false, "OKX preview does not call external execution");
assert.equal(raw.data.provider_label, "OKX Outcomes", "raw result carries provider label");
assert.equal(raw.data.usdt_amount, 3, "raw result carries USDT amount");
assert.equal(raw.data.limit_price, market.yesPrice, "raw result carries preview price");

const serialized = JSON.stringify(result).toLowerCase();
for (const forbidden of ["txhash", "signature", "signedpayload", "privatekey", "seedphrase", "broadcasted"]) {
  assert(!serialized.includes(forbidden), `OKX preview does not expose ${forbidden}`);
}

const card = createSimulationCard(result, market);
assert.equal(card.type, "simulation_card", "OKX preview creates a simulation card");
assert.equal(card.moneyMoved, false, "simulation card records no money movement");
assert(card.agentNote.includes("OKX Outcomes 本地模拟预览"), "simulation card explains OKX local preview");
assert(card.agentNote.includes("订单没有提交"), "simulation card states no order was submitted");
assert(card.agentNote.includes("没有签名或广播"), "simulation card states no signing or broadcast");
assert.equal(card.amountLabel, "3.000 USDT", "simulation card shows USDT amount");
assert.equal(card.priceLabel, "预览价 0.17", "simulation card shows OKX preview price");
assert.equal(card.market.provider, "okx-outcomes", "simulation card keeps OKX market");

const routeSource = read("app/api/v2/phase-one/actions/route.ts");
assert(
  routeSource.includes('body.market.provider === "okx-outcomes"') &&
    routeSource.includes("executeOkxOutcomesDryRunPreview") &&
    routeSource.includes("executePolymarketDryRun"),
  "phase-one action route branches OKX preview away from Polymarket dry-run"
);

const packageJson = JSON.parse(read("package.json"));
assert.equal(
  packageJson.scripts?.["smoke:okx-outcomes-simulation-preview"],
  "node --no-warnings --experimental-strip-types --loader ./scripts/ts-extension-loader.mjs v2/scripts/smoke-okx-outcomes-simulation-preview.mjs",
  "package exposes OKX simulation preview smoke"
);
assert(
  String(packageJson.scripts?.["verify:merge"] || "").includes("smoke:okx-outcomes-simulation-preview"),
  "verify:merge includes OKX simulation preview smoke"
);

const readinessDoc = read("docs/PREDICTION_MARKET_PHASE_TWO_READINESS.md");
assert(
  readinessDoc.includes("OKX Outcomes simulation preview") &&
    readinessDoc.includes("local/contract-style dry-run preview"),
  "readiness doc records provider-aware OKX preview"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: raw.provider,
      route: raw.route,
      safety: raw.safety,
      moneyMoved: raw.moneyMoved,
      checks: [
        "OKX provider retained",
        "OKX preview route used",
        "no tx hash, signing, or broadcast",
        "simulation card uses OKX copy",
        "merge gate includes smoke"
      ]
    },
    null,
    2
  )
);
