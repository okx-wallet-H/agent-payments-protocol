import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { jsonError, parseJson, parsePositiveNumber } from "@/lib/http";
import { normalizePredictionKeyword } from "@/lib/onchainos-router";
import { runPredictionAgent } from "@/lib/agent-runner";
import { getAgent, saveAgent } from "@/lib/store";

interface RunBody {
  amountOkb?: number;
  keyword?: string;
  ownerUserId?: string;
  userId?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<RunBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  let amountOkb;
  try {
    amountOkb = parsePositiveNumber(body.amountOkb, Math.min(0.01, agent.policy.maxSingleSpendOkb), "amountOkb");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid amountOkb", 400);
  }
  const keyword = normalizePredictionKeyword(body.keyword);
  if (!keyword) return jsonError("keyword is required", 400);

  const result = await runPredictionAgent(agent, amountOkb, keyword);

  const saved = await saveAgent(
    {
      ...agent,
      runs: [result.run, ...(agent.runs || [])],
      intents: result.intent ? [result.intent, ...agent.intents] : agent.intents,
      previews: result.preview ? [result.preview, ...(agent.previews || [])] : agent.previews
    },
    auditEvent(
      agent.id,
      result.run.status === "failed" ? "agent.run.failed" : "agent.run.completed",
      result.run.status === "failed" ? "Agent Run failed" : "Agent Run completed",
      {
        run: result.run,
        intent: result.intent,
        preview: result.preview
      }
    )
  );

  return NextResponse.json({ agent: saved, ...result }, { status: 201 });
}
