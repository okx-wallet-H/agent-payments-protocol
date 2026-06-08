import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, ".tmp", "v2-app-shell-panels");

const modules = [
  "v2/domain/types.ts",
  "v2/app/app-shell.ts",
  "v2/app/world-cup-info.ts",
  "v2/app/user-console.ts",
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

const { PHASE_ONE_APP_SHELL } = await import(path.join(outDir, "app-shell.mjs"));
const { createWorldCupInfoPanel } = await import(path.join(outDir, "world-cup-info.mjs"));
const { createUserConsolePanel } = await import(path.join(outDir, "user-console.mjs"));
const { mapPolymarketMarkets } = await import(path.join(outDir, "polymarket-output.mjs"));

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

console.log(JSON.stringify({
  shell: PHASE_ONE_APP_SHELL,
  panels: {
    topLeft: createWorldCupInfoPanel(markets),
    topRight: createUserConsolePanel({
      walletAddress: "0x65a92c1c5da328ae028e80c4fb2bfb223f652669"
    })
  }
}, null, 2));

function rewriteImports(code) {
  return code.replaceAll("../domain/types", "./types.mjs");
}
