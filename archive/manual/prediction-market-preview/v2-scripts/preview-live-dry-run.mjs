import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, ".tmp", "v2-live-dry-run");

const modules = [
  "v2/domain/types.ts",
  "v2/agent/business-agent.ts",
  "v2/agent/prediction-card.ts",
  "v2/agent/simulation-card.ts",
  "v2/execution/onchainos-polymarket.ts",
  "v2/execution/polymarket-output.ts",
  "v2/execution/polymarket-dry-run.ts"
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

const { createBusinessGoal, createPredictionResearchPlan } = await import(path.join(outDir, "business-agent.mjs"));
const { createPredictionCard } = await import(path.join(outDir, "prediction-card.mjs"));
const { createSimulationCard } = await import(path.join(outDir, "simulation-card.mjs"));
const { mapPolymarketMarkets, pickBestWorldCupMarket } = await import(path.join(outDir, "polymarket-output.mjs"));
const { createPolymarketDryRunPlan, executePolymarketDryRun } = await import(path.join(outDir, "polymarket-dry-run.mjs"));

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

const goal = createBusinessGoal("世界杯预测");
const researchPlan = createPredictionResearchPlan(goal, market);
const predictionCard = createPredictionCard(market);
const dryRunPlan = createPolymarketDryRunPlan({
  basePlan: researchPlan,
  amountUsd: 1,
  limitPrice: market.yesPrice
});
const dryRunResult = await executePolymarketDryRun(dryRunPlan);
const simulationCard = createSimulationCard(dryRunResult);

console.log(JSON.stringify({ marketCount: markets.length, predictionCard, simulationCard, dryRunResult }, null, 2));

function rewriteImports(code) {
  return code
    .replaceAll("../domain/types", "./types.mjs")
    .replaceAll("./onchainos-polymarket", "./onchainos-polymarket.mjs")
    .replaceAll("./prediction-card", "./prediction-card.mjs");
}
