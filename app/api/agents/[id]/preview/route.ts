import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { createPreviewForIntent } from "@/lib/agent-execution";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";

interface PreviewBody {
  intentId?: string;
  ownerUserId?: string;
  userId?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<PreviewBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  let result;
  try {
    result = createPreviewForIntent(agent, body.intentId);
  } catch {
    return jsonError("No intent found to preview", 404);
  }
  const saved = await saveAgent(
    {
      ...agent,
      previews: [result.preview, ...(agent.previews || [])]
    },
    auditEvent(agent.id, "execution.previewed", "Execution preview created", {
      intentId: result.intent.id,
      preview: result.preview
    })
  );

  return NextResponse.json({ agent: saved, preview: result.preview }, { status: 201 });
}
