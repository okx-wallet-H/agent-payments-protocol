import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { jsonError } from "@/lib/http";
import { getAgent, listAudit } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  const audit = await listAudit(id);
  return NextResponse.json({ audit });
}
