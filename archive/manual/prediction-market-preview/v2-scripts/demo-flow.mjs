import { readFile } from "node:fs/promises";
import ts from "typescript";

const files = [
  "v2/agent/business-agent.ts",
  "v2/security/policy.ts",
  "v2/execution/onchainos-polymarket.ts",
  "v2/security/security-boundary.ts",
  "v2/agent/receive-card.ts",
  "v2/agent/internal-funds.ts",
  "v2/agent/progress-stream.ts",
  "v2/agent/prediction-card.ts",
  "v2/agent/conversation-turn.ts",
  "v2/app/app-shell.ts",
  "v2/execution/polymarket-output.ts",
  "v2/execution/polymarket-dry-run.ts",
  "v2/agent/simulation-card.ts",
  "v2/agent/tracking-card.ts",
  "v2/agent/strategy-card.ts",
  "v2/app/world-cup-info.ts",
  "v2/app/user-console.ts",
  "v2/execution/polymarket-cli.ts"
];

for (const file of files) {
  const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      strict: true
    }
  });
  if (result.diagnostics?.length) {
    throw new Error(`${file} transpile diagnostics: ${JSON.stringify(result.diagnostics)}`);
  }
}

console.log("Agent Wallet v2 clean-layer smoke passed.");
