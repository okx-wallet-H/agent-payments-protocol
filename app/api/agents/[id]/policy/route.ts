import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { jsonError, parseJson, parsePositiveNumber } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";
import type { AgentPolicy } from "@/lib/types";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<Partial<AgentPolicy>>(request);
  const access = await checkAgentAccess(agent, request, body as { ownerUserId?: string; userId?: string });
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  let maxSingleSpendOkb;
  let dailyBudgetOkb;
  let dailyLossLimitOkb;
  try {
    maxSingleSpendOkb = parsePositiveNumber(
      body.maxSingleSpendOkb,
      agent.policy.maxSingleSpendOkb,
      "maxSingleSpendOkb"
    );
    dailyBudgetOkb = parsePositiveNumber(body.dailyBudgetOkb, agent.policy.dailyBudgetOkb, "dailyBudgetOkb");
    dailyLossLimitOkb = parsePositiveNumber(
      body.dailyLossLimitOkb,
      agent.policy.dailyLossLimitOkb,
      "dailyLossLimitOkb"
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid policy number", 400);
  }
  if (dailyBudgetOkb < maxSingleSpendOkb) {
    return jsonError("dailyBudgetOkb must be greater than or equal to maxSingleSpendOkb", 400);
  }
  const policy: AgentPolicy = {
    ...agent.policy,
    ...body,
    maxSingleSpendOkb,
    dailyBudgetOkb,
    dailyLossLimitOkb,
    allowedMarkets: body.allowedMarkets || agent.policy.allowedMarkets,
    allowedTokens: body.allowedTokens || agent.policy.allowedTokens,
    revoked: Boolean(body.revoked ?? agent.policy.revoked)
  };

  const saved = await saveAgent(
    { ...agent, policy },
    auditEvent(agent.id, "policy.updated", "Agent policy updated", { policy })
  );

  return NextResponse.json({ agent: saved, policy });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  return NextResponse.json({ policy: agent.policy });
}
