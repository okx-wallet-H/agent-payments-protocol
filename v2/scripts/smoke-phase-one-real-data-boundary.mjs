import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const routePath = path.join(repoRoot, "app", "api", "v2", "phase-one", "route.ts");
const conversationPath = path.join(repoRoot, "v2", "agent", "conversation-turn.ts");
const orchestratorPath = path.join(repoRoot, "v2", "agent", "orchestrator.ts");
const progressPath = path.join(repoRoot, "v2", "agent", "progress-stream.ts");

const route = fs.readFileSync(routePath, "utf8");
const conversation = fs.readFileSync(conversationPath, "utf8");
const orchestrator = fs.readFileSync(orchestratorPath, "utf8");
const progress = fs.readFileSync(progressPath, "utf8");
const checks = [];

check(route.includes('readPredictionExploreData("auto")'), "phase-one uses auto real prediction data reader");
check(route.includes("pickBestOkxWorldCupMarket(data.markets)"), "phase-one chooses from returned real-data markets");
check(!route.includes("sampleOkxWorldCupPayload"), "phase-one does not import local sample payload");
check(!route.includes("normalizeOkxOutcomes(sampleOkxWorldCupPayload"), "phase-one does not normalize local sample payload");
check(!route.includes("getWorldCupCandidateMarket"), "phase-one does not call plugin-only candidate fallback directly");
check(!route.includes("keep the Agent flow card-backed"), "phase-one does not preserve card-backed fake fallback copy");

check(conversation.includes("暂时没有拿到真实预测市场数据"), "conversation explains real-data unavailable state");
check(!conversation.includes("我先去找世界杯相关市场"), "conversation no longer claims hidden world cup lookup");
check(orchestrator.includes("读取真实预测市场并生成观察卡"), "orchestrator uses real-data prediction progress hint");
check(progress.includes("正在整理真实预测市场"), "progress stream avoids world cup sample wording");

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

function check(condition, label) {
  if (!condition) throw new Error(`phase-one real-data boundary smoke failed: ${label}`);
  checks.push(label);
}
