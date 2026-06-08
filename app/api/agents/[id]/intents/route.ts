import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { jsonError, parseJson, parsePositiveNumber } from "@/lib/http";
import { createPredictionIntent, type PredictionInput } from "@/lib/prediction";
import { evaluateIntent } from "@/lib/risk";
import { getAgent, saveAgent } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const input = await parseJson<PredictionInput>(request);
  const access = await checkAgentAccess(agent, request, input as { ownerUserId?: string; userId?: string });
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  try {
    if (input.amountOkb !== undefined) {
      input.amountOkb = parsePositiveNumber(input.amountOkb, Math.min(0.01, agent.policy.maxSingleSpendOkb), "amountOkb");
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid amountOkb", 400);
  }
  const intent = createPredictionIntent(agent, input);
  const riskNotes = evaluateIntent(agent, intent);
  const nextIntent = {
    ...intent,
    riskNotes,
    status: riskNotes.length > 0 ? ("blocked" as const) : ("approved" as const)
  };

  const saved = await saveAgent(
    { ...agent, intents: [nextIntent, ...agent.intents] },
    auditEvent(
      agent.id,
      riskNotes.length > 0 ? "intent.blocked" : "intent.created",
      riskNotes.length > 0 ? "Prediction intent blocked by policy" : "Prediction intent created",
      { intent: nextIntent }
    )
  );

  return NextResponse.json({ agent: saved, intent: nextIntent }, { status: 201 });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  return NextResponse.json({ intents: agent.intents });
}
