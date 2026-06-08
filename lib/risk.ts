import type { Agent, TradeIntent } from "./types";

export function evaluateIntent(agent: Agent, intent: TradeIntent): string[] {
  const notes: string[] = [];
  const now = Date.now();
  const policyExpiry = Date.parse(agent.policy.expiresAt);

  if (agent.status !== "active") notes.push(`Agent is ${agent.status}`);
  if (agent.policy.revoked) notes.push("Policy has been revoked");
  if (Number.isFinite(policyExpiry) && policyExpiry < now) notes.push("Policy has expired");
  if (!agent.vault) notes.push("Agent vault is not configured");
  if (intent.amountOkb > agent.policy.maxSingleSpendOkb) {
    notes.push(`Intent amount ${intent.amountOkb} OKB exceeds max single spend ${agent.policy.maxSingleSpendOkb} OKB`);
  }
  if (!agent.policy.allowedMarkets.includes(intent.market)) {
    notes.push(`Market ${intent.market} is not allowed by policy`);
  }
  if (intent.confidence < 0.55) notes.push("Confidence is below minimum execution threshold");

  const today = new Date().toISOString().slice(0, 10);
  const spentToday = agent.executions
    .filter((execution) => execution.createdAt.startsWith(today))
    .filter((execution) => execution.status === "executed" || execution.status === "simulated")
    .reduce((sum, execution) => sum + execution.costOkb, 0);

  if (spentToday + intent.amountOkb > agent.policy.dailyBudgetOkb) {
    notes.push(`Daily budget would be exceeded: ${spentToday + intent.amountOkb} / ${agent.policy.dailyBudgetOkb} OKB`);
  }

  return notes;
}
