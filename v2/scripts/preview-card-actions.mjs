import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, ".tmp", "v2-card-actions");

const modules = [
  "v2/domain/types.ts",
  "v2/agent/prediction-card.ts",
  "v2/agent/tracking-card.ts",
  "v2/agent/strategy-card.ts",
  "v2/execution/polymarket-output.ts"
];

await mkdir(outDir, { recursive: true });

for (const file of modules) {
  const source = await readFile(path.join(root, file), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    }
  }).outputText;
  await writeFile(path.join(outDir, path.basename(file).replace(".ts", ".mjs")), rewriteImports(transpiled));
}

const { createPredictionCard } = await import(path.join(outDir, "prediction-card.mjs"));
const { createTrackingCard } = await import(path.join(outDir, "tracking-card.mjs"));
const { createStrategyCard } = await import(path.join(outDir, "strategy-card.mjs"));
const { mapPolymarketMarkets, pickBestWorldCupMarket } = await import(path.join(outDir, "polymarket-output.mjs"));

const { stdout } = await execFileAsync("polymarket-plugin", [
  "list-markets",
  "--keyword",
  "World Cup",
  "--limit",
  "8"
], {
  cwd: root,
  timeout: 30_000,
  maxBuffer: 1024 * 1024
});

const markets = mapPolymarketMarkets(JSON.parse(stdout));
const market = pickBestWorldCupMarket(markets);
if (!market) throw new Error("No World Cup market found.");

console.log(JSON.stringify({
  marketCount: markets.length,
  cards: [
    createPredictionCard(market),
    createTrackingCard(market),
    createStrategyCard(market)
  ]
}, null, 2));

function rewriteImports(code) {
  return code.replaceAll("../domain/types", "./types.mjs");
}
