import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const appPage = read("app/page.tsx");
const packageJson = JSON.parse(read("package.json"));
const checks = [];

check(appPage.includes('const [agentName, setAgentName] = useState("预测市场助手")'), "root web agent name is generic");
check(appPage.includes('const [chatInput, setChatInput] = useState("")'), "root web chat input starts empty");
check(appPage.includes("const predictionKeyword = chatInput.trim()"), "root web derives prediction keyword from user input");
check(appPage.includes('if (!predictionKeyword) throw new Error("请先输入一个明确市场或事件")'), "root web blocks blank market loads/runs");
check(appPage.includes('if (!predictionKeyword) throw new Error("请先输入你想让 Agent 看的目标")'), "root web blocks blank agent chat");
check(appPage.includes('new URLSearchParams({ keyword: predictionKeyword, limit: "10" })'), "root web market list uses explicit keyword");
check(appPage.includes("body: JSON.stringify({ content: predictionKeyword, userId: ownerUserId })"), "root web chat uses explicit user keyword");
check(appPage.includes("body: JSON.stringify({ amountOkb: Number(intentAmount), keyword: predictionKeyword })"), "root web agent run uses explicit user keyword");
check(appPage.includes("market: selectedMarket.slug || selectedMarket.id"), "root web intent uses observed selected market");
check(appPage.includes('market: "prediction-market-observed"'), "root web fallback market is generic observed market");
check(appPage.includes("disabled={state.busy || !predictionKeyword}"), "root web disables prediction actions until user names a target");
check(packageJson.scripts?.["smoke:web-root-real-data-boundary"] === "node v2/scripts/smoke-web-root-real-data-boundary.mjs", "package exposes root web real-data boundary smoke");
check(packageJson.scripts?.["verify:merge"]?.includes("npm run smoke:web-root-real-data-boundary"), "merge verification includes root web real-data boundary smoke");

reject(appPage, "世界杯机会助手", "root web no longer defaults to a World Cup assistant");
reject(appPage, "帮我看看世界杯有没有机会", "root web no longer primes chat with a World Cup prompt");
reject(appPage, 'keyword: "World Cup"', "root web no longer fetches hidden World Cup markets");
reject(appPage, 'new URLSearchParams({ keyword: "World Cup"', "root web market list has no hardcoded World Cup query");
reject(appPage, "polymarket-world-cup-2026", "root web has no Polymarket World Cup fallback market");
reject(appPage, "okx-world-cup-2026", "root web has no OKX World Cup fallback market");
reject(appPage, "/agents/agent-worldcup.jpg", "root web no longer loads World Cup avatar art");
reject(appPage, "世界杯版", "root web login chip is no longer World Cup branded");

console.log(
  JSON.stringify(
    {
      ok: true,
      checks
    },
    null,
    2
  )
);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function check(condition, label) {
  if (!condition) throw new Error(`web root real-data boundary smoke failed: ${label}`);
  checks.push(label);
}

function reject(source, needle, label) {
  check(!source.includes(needle), label);
}
