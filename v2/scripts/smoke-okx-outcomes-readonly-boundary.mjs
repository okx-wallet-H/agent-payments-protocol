import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "OKX_OUTCOMES_READONLY_INTEGRATION.md");
const packagePath = path.join(repoRoot, "package.json");
const doc = fs.readFileSync(docPath, "utf8");
const lowerDoc = doc.toLowerCase();
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const checks = [];

check(doc.includes("PR #122") && doc.includes("PR #128"), "document ties boundary to PR #122-#128");
check(hasAll(["read-only", "只读", "observe/simulate"]), "document states read-only observe/simulate boundary");
check(hasAll(["agent explanation", "会 / 不会", "odds"]), "document covers Agent odds explanation");
check(hasAll(["detail page", "order book", "volume", "liquidity"]), "document covers detail page market data");
check(hasAll(["asset id", "redacted"]), "document requires asset id redaction");
check(hasAll(["acceptingorders", "external market state", "do not grant"]), "document clarifies acceptingOrders is not order permission");

const forbiddenActions = [
  "live prediction order placement",
  "live buy or sell execution",
  "transaction signing",
  "swap or bridge execution",
  "transaction broadcast",
  "autonomous money movement",
  "private key"
];

for (const action of forbiddenActions) {
  check(lowerDoc.includes(action), `forbidden action is documented: ${action}`);
}

const futureGates = [
  "allowlist",
  "production policy",
  "execution preview",
  "confirm code",
  "audit trail",
  "monitoring"
];

for (const gate of futureGates) {
  check(lowerDoc.includes(gate), `future live gate is documented: ${gate}`);
}

check(
  !/0x[a-fA-F0-9]{40}/.test(doc),
  "document does not include a full wallet address"
);
check(
  !/(api[_ -]?key|secret|passphrase)\s*[:=]\s*[A-Za-z0-9_-]{8,}/i.test(doc),
  "document does not include credential-looking values"
);
check(
  packageJson.scripts?.["smoke:okx-outcomes-readonly-boundary"] ===
    "node v2/scripts/smoke-okx-outcomes-readonly-boundary.mjs",
  "package.json exposes readonly-boundary smoke script"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks,
      document: path.relative(repoRoot, docPath),
      forbiddenActions: forbiddenActions.length,
      futureGates: futureGates.length
    },
    null,
    2
  )
);

function hasAll(phrases) {
  return phrases.every((phrase) => lowerDoc.includes(phrase.toLowerCase()));
}

function check(condition, label) {
  if (!condition) throw new Error(`OKX Outcomes readonly boundary smoke failed: ${label}`);
  checks.push(label);
}
