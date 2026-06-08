import type { AgentPolicy } from "./types";

export const DEFAULT_POLICY: AgentPolicy = {
  maxSingleSpendOkb: 0.02,
  dailyBudgetOkb: 0.05,
  dailyLossLimitOkb: 0.03,
  allowedMarkets: ["okx-world-cup-2026", "okx-exchange-os-observed", "polymarket-world-cup-2026"],
  allowedTokens: ["OKB"],
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  revoked: false
};

export const PRODUCT_NOTES = [
  "用户只需要说目标，AI 先分析、给方案、说明风险，确认后才会进入执行流程。",
  "交易签名基于 TEE 可信执行环境，私钥永不离开 TEE；所有操作默认小额、先预览、留记录。",
  "高级审计里仍保留底层工具、策略、市场来源和执行记录，方便追溯。"
];
