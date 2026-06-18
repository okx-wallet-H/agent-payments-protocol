import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const screenPath = path.join(repoRoot, "apps", "mobile", "src", "V2AgentWalletScreen.tsx");
const screen = await readFile(screenPath, "utf8");

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
    pass: () => /\bAPI\s*(?:Key|KEY)\b/.test(screen) && /绑定位|绑定/.test(screen)
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
    label: "mobile prediction-market UI says live order placement is closed",
    pass: () => /下单未开放|暂不开放下单|真实下单关闭/.test(screen)
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
      screen: path.relative(repoRoot, screenPath),
      checks: checks.map((check) => check.label)
    },
    null,
    2
  )
);
