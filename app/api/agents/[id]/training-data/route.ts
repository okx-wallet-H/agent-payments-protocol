import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { buildAgentTrainingExamples, toJsonl } from "@/lib/agent-training";
import { jsonError } from "@/lib/http";
import { getAgent } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);

  const url = new URL(request.url);
  const examples = buildAgentTrainingExamples(agent);
  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({ examples, count: examples.length });
  }

  return new Response(toJsonl(examples), {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="agent-${agent.id}-training-data.jsonl"`
    }
  });
}
