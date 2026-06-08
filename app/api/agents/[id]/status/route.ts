import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";
import type { AgentStatus } from "@/lib/types";

interface StatusBody {
  status?: AgentStatus;
  ownerUserId?: string;
  userId?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<StatusBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  if (!body.status || !["active", "paused", "revoked"].includes(body.status)) {
    return jsonError("Expected status to be active, paused, or revoked");
  }

  const nextAgent = {
    ...agent,
    status: body.status,
    policy: body.status === "revoked" ? { ...agent.policy, revoked: true } : agent.policy
  };

  const saved = await saveAgent(
    nextAgent,
    auditEvent(
      agent.id,
      body.status === "revoked" ? "agent.revoked" : "agent.paused",
      `Agent status changed to ${body.status}`,
      { status: body.status }
    )
  );

  return NextResponse.json({ agent: saved });
}
