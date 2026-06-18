import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const screenPath = path.join(repoRoot, "apps", "mobile", "src", "V2AgentWalletScreen.tsx");
const apiPath = path.join(repoRoot, "apps", "mobile", "src", "api.ts");
const hookPath = path.join(repoRoot, "apps", "mobile", "src", "use-v2-agent-wallet.ts");
const typesPath = path.join(repoRoot, "apps", "mobile", "src", "types.ts");
const screen = await readFile(screenPath, "utf8");
const api = await readFile(apiPath, "utf8");
const hook = await readFile(hookPath, "utf8");
const types = await readFile(typesPath, "utf8");

const requirements = [
  {
    label: "mobile prediction-market UI names 预测市场",
    pass: () => /预测市场/.test(screen)
  },
  {
    label: "mobile prediction-market UI names OKX Outcomes",
    pass: () => /OKX Outcomes/.test(screen)
  },
  {
    label: "mobile prediction-market UI exposes an API Key/API KEY binding slot",
    pass: () => /\bAPI\s*(?:Key|KEY)\b/.test(screen) && /绑定入口预留/.test(screen) && /待开放/.test(screen)
  },
  {
    label: "mobile prediction-market UI states 只读查询",
    pass: () => /只读查询/.test(screen)
  },
  {
    label: "mobile prediction-market UI renders read-only detail sync and order book summary",
    pass: () => /只读详情已同步/.test(screen) && /订单簿摘要/.test(screen) && /买/.test(screen) && /卖/.test(screen)
  },
  {
    label: "mobile prediction-market UI offers 观察/模拟",
    pass: () => /观察/.test(screen) && /模拟/.test(screen)
  },
  {
    label: "mobile prediction-market UI exposes capability panel",
    pass: () =>
      /当前能力/.test(screen) &&
      /可查询/.test(screen) &&
      /市场详情/.test(screen) &&
      /会\/不会赔率/.test(screen) &&
      /订单簿摘要/.test(screen) &&
      /成交量\/流动性/.test(screen) &&
      /可操作/.test(screen) &&
      /加入跟踪/.test(screen) &&
      /生成策略/.test(screen) &&
      /占位关闭/.test(screen) &&
      /真实下单/.test(screen) &&
      /签名/.test(screen) &&
      /广播/.test(screen)
  },
  {
    label: "mobile prediction-market UI wires track and strategy to safe Agent actions",
    pass: () =>
      /action\.id === "track" \|\| action\.id === "build_strategy"/.test(screen) &&
      /onRunMarketAction\(action\.id, card\)/.test(screen)
  },
  {
    label: "mobile prediction-market UI renders disabled order placeholder from action model",
    pass: () =>
      /action\.enabled === false/.test(screen) &&
      /predictionDetailActionIcon\(action\.id\)/.test(screen) &&
      /"order_closed"/.test(types) &&
      /kind: V2PredictionDetailActionKind/.test(types) &&
      /enabled: boolean/.test(types)
  },
  {
    label: "mobile prediction-market UI says live order placement is closed",
    pass: () => /下单未开放|暂不开放下单|真实下单关闭/.test(screen)
  },
  {
    label: "mobile prediction-market API preserves detail source response",
    pass: () =>
      /getPredictionDetail\(marketId: string\): Promise<V2PredictionDetailResponse>/.test(api) &&
      /return request<V2PredictionDetailResponse>/.test(api) &&
      !/return data\.detail/.test(api)
  },
  {
    label: "mobile prediction-market hook preserves detail source response",
    pass: () =>
      /loadPredictionDetail = useCallback\(\(marketId: string\): Promise<V2PredictionDetailResponse>/.test(hook) &&
      /return api\.getPredictionDetail\(marketId\)/.test(hook)
  },
  {
    label: "mobile prediction-market types expose detail source contract",
    pass: () =>
      /interface V2PredictionDetailSource/.test(types) &&
      /mode: "live_or_fallback" \| "sample"/.test(types) &&
      /providerStatus\?: "connected" \| "not_configured" \| "sample"/.test(types) &&
      /credentialsBound\?: boolean/.test(types) &&
      /apiKeyBindingLabel\?: string/.test(types) &&
      /liveExecutionClosed: true/.test(types) &&
      /interface V2PredictionDetailResponse/.test(types)
  },
  {
    label: "mobile prediction-market UI reads source mode and execution gate",
    pass: () => /detailSource/.test(screen) && /同步模式/.test(screen) && /predictionExecutionLabel/.test(screen)
  },
  {
    label: "mobile prediction-market UI renders backend action model",
    pass: () =>
      /createPredictionDetailActions/.test(screen) &&
      /detailActions\.map/.test(screen) &&
      /id: "track"/.test(screen) &&
      /id: "build_strategy"/.test(screen) &&
      /id: "order_closed"/.test(screen)
  },
  {
    label: "mobile prediction-market UI avoids misleading live-execution reward copy",
    pass: () => !/执行都会累计积分|执行或分享会额外加成/.test(screen)
  },
  {
    label: "mobile prediction-market UI keeps API key binding disabled in app",
    pass: () =>
      /predictionApiKeySlot} disabled/.test(screen) &&
      /暂未开放绑定/.test(screen) &&
      /credentialsBound/.test(screen) &&
      /apiKeyBindingLabel/.test(screen) &&
      /不在本机保存密钥/.test(screen)
  }
];

const checks = requirements.map((requirement) => ({
  label: requirement.label,
  ok: requirement.pass()
}));
const missing = checks.filter((check) => !check.ok).map((check) => check.label);

assert.equal(
  missing.length,
  0,
  `mobile prediction-market UI contract failed; missing: ${missing.join("; ")}`
);

console.log(
  JSON.stringify(
    {
      ok: true,
      files: [screenPath, apiPath, hookPath, typesPath].map((filePath) => path.relative(repoRoot, filePath)),
      checks: checks.map((check) => check.label)
    },
    null,
    2
  )
);
