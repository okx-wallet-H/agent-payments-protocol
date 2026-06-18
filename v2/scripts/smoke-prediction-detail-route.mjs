import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const routePath = path.join(repoRoot, "app", "api", "v2", "prediction", "detail", "route.ts");
const routeLabel = path.relative(repoRoot, routePath);

if (!existsSync(routePath)) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: true,
        route: routeLabel,
        reason: "prediction detail route is not implemented yet"
      },
      null,
      2
    )
  );
  process.exit(0);
}

const source = readFileSync(routePath, "utf8");
const checks = [];

check(
  source.includes("createPredictionDetailView"),
  "route uses createPredictionDetailView for the public response"
);
check(
  source.includes("getOkxOutcomeMarketData"),
  "route reads OKX Outcomes market data through the read-only client"
);
check(
  source.includes("guardPredictionReadRequest"),
  "route guards read access before reading OKX Outcomes data"
);
check(
  /includeOrderBook\s*:\s*true/.test(source),
  "route explicitly requests order book data"
);
check(
  !/\bexport\s+async\s+function\s+POST\b/.test(source),
  "route does not define a POST handler"
);

const forbiddenExecutionTokens = [
  "\\bPOST\\b",
  "\\bswap\\b",
  "\\bbroadcast\\b",
  "\\bsignTransaction\\b",
  "\\bsubmitOrder\\b",
  "\\bplaceOrder\\b",
  "\\bcreateOrder\\b",
  "\\bsendTransaction\\b",
  "\\bwriteContract\\b",
  "\\bmoneyMoved\\s*:\\s*true\\b"
];

for (const token of forbiddenExecutionTokens) {
  const pattern = new RegExp(token, "i");
  check(!pattern.test(source), `route source does not contain live execution token: ${token}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      skipped: false,
      route: routeLabel,
      checks
    },
    null,
    2
  )
);

function check(condition, label) {
  assert(condition, `prediction detail route readonly smoke failed: ${label}`);
  checks.push(label);
}
