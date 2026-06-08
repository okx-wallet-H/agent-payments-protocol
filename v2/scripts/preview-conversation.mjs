import { readFile, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, ".tmp", "v2-preview");

const modules = [
  "v2/domain/types.ts",
  "v2/agent/business-agent.ts",
  "v2/agent/receive-card.ts",
  "v2/agent/prediction-card.ts",
  "v2/agent/progress-stream.ts",
  "v2/agent/conversation-turn.ts",
  "v2/app/app-shell.ts"
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
const { PHASE_ONE_APP_SHELL } = await import(path.join(outDir, "app-shell.mjs"));

const addresses = {
  xLayerAddress: "0x65a92c1c5da328ae028e80c4fb2bfb223f652669",
  polygonAddress: "0x65a92c1c5da328ae028e80c4fb2bfb223f652669"
};

const worldCupMarket = {
  provider: "polymarket-plugin",
  chainId: 137,
  marketId: "0xcdb1f0400949238a63d3e88243d2ada08cd9c2a71985ced9f0cfd5e66354cf90",
  question: "Will USA win the 2026 FIFA World Cup?",
  yesPrice: 0.0115,
  noPrice: 0.9885,
  acceptingOrders: true,
  liquidity: 6352951.59677,
  volume24h: 1478868.9936070004,
  endDate: "2026-07-20T00:00:00Z"
};

const demo = {
  shell: PHASE_ONE_APP_SHELL,
  turns: [
    handlePhaseOneUserText({
      userText: "我要充值500U",
      ...addresses
    }),
    handlePhaseOneUserText({
      userText: "世界杯预测",
      ...addresses,
      candidateMarket: worldCupMarket
    })
  ]
};

console.log(JSON.stringify(demo, null, 2));

function rewriteImports(code) {
  return code
    .replaceAll("../domain/types", "./types.mjs")
    .replaceAll("./business-agent", "./business-agent.mjs")
    .replaceAll("./prediction-card", "./prediction-card.mjs")
    .replaceAll("./receive-card", "./receive-card.mjs")
    .replaceAll("./progress-stream", "./progress-stream.mjs");
}
