import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { confirmExecutionPreview } from "@/lib/execution-preview";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";

interface ConfirmBody {
  previewId?: string;
  confirmationText?: string;
  confirmedBy?: string;
  ownerUserId?: string;
  userId?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<ConfirmBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  if (!body.previewId) return jsonError("previewId is required", 400);

  const preview = (agent.previews || []).find((item) => item.id === body.previewId);
  if (!preview) return jsonError("Preview not found", 404);

  try {
    const confirmedPreview = confirmExecutionPreview(preview, body.confirmationText || "", body.confirmedBy);
    if (confirmedPreview.confirmationStatus === "expired") {
      return jsonError("Preview has expired; create a fresh preview before confirming", 409);
    }

    const isConfirmed = confirmedPreview.confirmationStatus === "confirmed";
    const saved = await saveAgent(
      {
        ...agent,
        previews: agent.previews.map((item) => (item.id === preview.id ? confirmedPreview : item))
      },
      auditEvent(agent.id, isConfirmed ? "execution.confirmed" : "execution.previewed", isConfirmed ? "Execution preview confirmed" : "Execution preview confirmation failed", {
        previewId: preview.id,
        intentId: preview.intentId,
        confirmationStatus: confirmedPreview.confirmationStatus,
        confirmationAttempts: confirmedPreview.confirmationAttempts
      })
    );

    if (!isConfirmed) {
      const locked = confirmedPreview.confirmationStatus === "locked";
      return NextResponse.json(
        {
          agent: saved,
          preview: confirmedPreview,
          error: locked ? "确认码错误次数过多，请重新生成方案。" : "确认码不正确，请再试一次。"
        },
        { status: locked ? 423 : 400 }
      );
    }

    return NextResponse.json({ agent: saved, preview: confirmedPreview });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Preview confirmation failed", 400);
  }
}
