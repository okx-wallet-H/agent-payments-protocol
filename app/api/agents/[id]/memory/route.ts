import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { createDefaultAgentMemory, summarizeAgentMemory } from "@/lib/agent-memory";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";

interface MemoryBody {
  action?: "reset";
  ownerUserId?: string;
  userId?: string;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  return NextResponse.json({
    memory: agent.memory,
    summary: summarizeAgentMemory(agent.memory)
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<MemoryBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  if (body.action !== "reset") return jsonError("Unsupported memory action", 400);

  const memory = createDefaultAgentMemory();
  const saved = await saveAgent(
    {
      ...agent,
      memory
    },
    auditEvent(agent.id, "agent.memory.updated", "Agent memory reset", { memory })
  );

  return NextResponse.json({ agent: saved, memory, summary: summarizeAgentMemory(memory) });
}
