import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { executeAgentIntent } from "@/lib/agent-execution";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";

interface ExecuteBody {
  intentId?: string;
  previewId?: string;
  ownerUserId?: string;
  userId?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<ExecuteBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  let result;
  try {
    result = executeAgentIntent(agent, body.intentId, body.previewId);
  } catch {
    return jsonError("No intent found to execute", 404);
  }

  const saved = await saveAgent(
    {
      ...agent,
      intents: result.intents,
      executions: [result.execution, ...agent.executions]
    },
    auditEvent(agent.id, result.auditType, result.auditMessage, result.auditMetadata)
  );

  return NextResponse.json({ agent: saved, execution: result.execution }, { status: result.statusCode });
}
