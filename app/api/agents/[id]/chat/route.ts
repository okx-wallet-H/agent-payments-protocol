import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { handleAgentChat } from "@/lib/agent-chat";
import { updateAgentMemory } from "@/lib/agent-memory";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";

interface ChatBody {
  content?: string;
  userId?: string;
  ownerUserId?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<ChatBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  if (!body.content?.trim()) return jsonError("content is required", 400);

  const result = await handleAgentChat(agent, body.content, body.userId);
  const nextMemory = updateAgentMemory(
    { ...agent, ...result.agentPatch },
    result.messages[0],
    result.messages[1]
  );
  const saved = await saveAgent(
    {
      ...agent,
      ...result.agentPatch,
      memory: nextMemory
    },
    buildChatAuditEvents(agent.id, result, nextMemory)
  );

  return NextResponse.json({ agent: saved, messages: result.messages }, { status: 201 });
}

function buildChatAuditEvents(
  agentId: string,
  result: Awaited<ReturnType<typeof handleAgentChat>>,
  memory: ReturnType<typeof updateAgentMemory>
) {
  const assistantMessage = result.messages[1];
  const events = [
    auditEvent(agentId, "agent.chat.message", "Agent chat processed", {
      userMessage: result.messages[0],
      assistantMessage,
      memory
    })
  ];

  if (assistantMessage.action === "run_agent") {
    events.push(
      auditEvent(
        agentId,
        assistantMessage.toolResult?.status === "failed" ? "agent.run.failed" : "agent.run.completed",
        assistantMessage.toolResult?.status === "failed" ? "Agent Run failed from chat" : "Agent Run completed from chat",
        assistantMessage.toolResult || {}
      )
    );
  }

  if (assistantMessage.action === "preview_intent") {
    events.push(
      auditEvent(agentId, "execution.previewed", "Execution preview created from chat", assistantMessage.toolResult || {})
    );
  }

  if (
    assistantMessage.action === "confirm_preview" &&
    assistantMessage.toolResult?.confirmationStatus === "confirmed"
  ) {
    events.push(
      auditEvent(agentId, "execution.confirmed", "Execution preview confirmed from chat", assistantMessage.toolResult)
    );
  }

  if (assistantMessage.action === "execute_intent") {
    const status = assistantMessage.toolResult?.status;
    events.push(
      auditEvent(
        agentId,
        status === "blocked" ? "intent.blocked" : status === "executed" ? "execution.executed" : "execution.simulated",
        status === "blocked" ? "Execution blocked from chat" : "Execution requested from chat",
        assistantMessage.toolResult || {}
      )
    );
  }

  return events;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  return NextResponse.json({ messages: agent.messages || [] });
}
