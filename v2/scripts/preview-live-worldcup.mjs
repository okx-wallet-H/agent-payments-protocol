import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, ".tmp", "v2-live-preview");

const modules = [
  "v2/domain/types.ts",
  "v2/agent/business-agent.ts",
  "v2/agent/receive-card.ts",
  "v2/agent/prediction-card.ts",
  "v2/agent/progress-stream.ts",
  "v2/agent/conversation-turn.ts",
  "v2/app/app-shell.ts",
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

const { handlePhaseOneUserText } = await import(path.join(outDir, "conversation-turn.mjs"));
const { mapPolymarketMarkets, pickBestWorldCupMarket } = await import(path.join(outDir, "polymarket-output.mjs"));
const { PHASE_ONE_APP_SHELL } = await import(path.join(outDir, "app-shell.mjs"));

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

const pluginOutput = JSON.parse(stdout);
const markets = mapPolymarketMarkets(pluginOutput);
const candidateMarket = pickBestWorldCupMarket(markets);

const turn = handlePhaseOneUserText({
  userText: "世界杯预测",
  xLayerAddress: "0x65a92c1c5da328ae028e80c4fb2bfb223f652669",
  polygonAddress: "0x65a92c1c5da328ae028e80c4fb2bfb223f652669",
  candidateMarket
});

console.log(JSON.stringify({ shell: PHASE_ONE_APP_SHELL, marketCount: markets.length, turn }, null, 2));

function rewriteImports(code) {
  return code
    .replaceAll("../domain/types", "./types.mjs")
    .replaceAll("./business-agent", "./business-agent.mjs")
    .replaceAll("./prediction-card", "./prediction-card.mjs")
    .replaceAll("./receive-card", "./receive-card.mjs")
    .replaceAll("./progress-stream", "./progress-stream.mjs");
}
