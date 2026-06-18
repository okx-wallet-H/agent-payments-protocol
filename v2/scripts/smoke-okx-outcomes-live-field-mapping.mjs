import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
const verifyMerge = String(scripts["verify:merge"] || "");
const client = read("v2/execution/okx-outcomes-client.ts");
const output = read("v2/execution/okx-outcomes-output.ts");
const detailView = read("v2/app/prediction-detail-view.ts");
const catalogSmoke = read("v2/scripts/smoke-outcomes-market-catalog.mjs");
const mappingDoc = read("docs/OKX_OUTCOMES_LIVE_FIELD_MAPPING.md");
const boundaryDoc = read("docs/OKX_OUTCOMES_READONLY_INTEGRATION.md");

const checks = [];
function check(condition, label) {
  assert(condition, `OKX Outcomes live field mapping smoke failed: ${label}`);
  checks.push(label);
}

check(
  scripts["smoke:okx-outcomes-live-field-mapping"] === "node v2/scripts/smoke-okx-outcomes-live-field-mapping.mjs",
  "package exposes live field mapping smoke"
);
check(
  verifyMerge.includes("smoke:okx-outcomes-live-field-mapping"),
  "verify:merge includes live field mapping smoke"
);

check(mappingDoc.includes("Do not use `marketId` as the `instId`"), "mapping doc blocks marketId-as-instId drift");
check(mappingDoc.includes("yesAssetId") && mappingDoc.includes("noAssetId"), "mapping doc names YES/NO outcome ids");
check(mappingDoc.includes("Settlement And Final Result"), "mapping doc records settlement/final-result gap");
check(mappingDoc.includes("not yet consumed by the App"), "mapping doc keeps settlement hidden until live schema is proven");
check(mappingDoc.includes("live-sample task is still read-only"), "mapping doc keeps live sample task read-only");

check(client.includes("getMarket(marketId") && client.includes("/api/v5/predictions/markets/"), "client uses marketId only for market detail");
check(
  /instId:\s*market\?\.yesAssetId/.test(client) && /instId:\s*market\?\.noAssetId/.test(client),
  "client enriches ticker/candle/order book from outcome asset ids"
);
check(
  client.includes("query: { instId }") && client.includes("query: { instId, sz: size }"),
  "client sends outcome asset id as instId to market endpoints"
);
check(
  client.includes("/api/v5/market/ticker") &&
    client.includes("/api/v5/market/candles") &&
    client.includes("/api/v5/market/pm-books"),
  "client keeps ticker/candle/order-book endpoint coverage"
);
check(
  !/\b(method\s*=\s*["']POST["']|export\s+async\s+function\s+POST|placeOrder|submitOrder|createOrder|broadcast|signTransaction)\b/i.test(
    client
  ),
  "client remains read-only and does not expose execution methods"
);

check(
  output.includes('["assetId", "asset_id", "instId", "inst_id"]'),
  "normalizer accepts provider asset aliases for outcome ids"
);
check(
  output.includes('readArray(market, ["outcomes", "outcomeList", "outcome_list"])') &&
    output.includes('readUnknown(market, ["yesOutcome", "yes_outcome", "yes"])') &&
    output.includes('readUnknown(market, ["noOutcome", "no_outcome", "no"])'),
  "normalizer reads both list and side-object outcome shapes"
);

check(detailView.includes("assetIdLabel") && detailView.includes("shortenId"), "detail view uses redacted asset id labels");
check(catalogSmoke.includes("catalog output avoids full YES asset id"), "catalog smoke rejects full YES asset id exposure");
check(catalogSmoke.includes("catalog output avoids transaction terms"), "catalog smoke rejects transaction wording");

for (const forbidden of [
  "live prediction order placement",
  "transaction signing",
  "transaction broadcast",
  "private key"
]) {
  check(boundaryDoc.includes(forbidden), `boundary doc forbids ${forbidden}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      boundary: "OKX Outcomes live field mapping stays read-only",
      checks
    },
    null,
    2
  )
);
