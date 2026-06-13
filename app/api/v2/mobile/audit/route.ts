import { NextResponse } from "next/server";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { listAuditTimelineEvents } from "@/v2/storage/audit-timeline-store";
import { listPhaseOneRecords } from "@/v2/storage/phase-one-store";
import { loadUserSession } from "@/v2/storage/user-session-store";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function GET(request: Request) {
  const user = await resolvePhaseOneUser(request);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") || "30");
  const [events, records, memory] = await Promise.all([
    listAuditTimelineEvents(user.userId, Number.isFinite(limit) ? limit : 30),
    listPhaseOneRecords(user.userId),
    loadUserSession(user.userId)
  ]);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const walletRecordsById = new Map((memory?.walletRecords || []).map((record) => [record.id, record]));
  return jsonWithCors({
    events: events.map((event) => {
      const record = (event.recordId ? recordsById.get(event.recordId) : undefined) ||
        records.find((item) => isRecordForAuditEvent(item, event));
      const walletRecord = event.walletRecordId ? walletRecordsById.get(event.walletRecordId) : undefined;
      if (!record && !walletRecord) return event;
      return {
        ...event,
        ...(record
          ? {
              recordId: record.id,
              card: record.card
            }
          : {}),
        ...(walletRecord ? { walletRecord } : {})
      };
    })
  });
}

function isRecordForAuditEvent(
  record: Awaited<ReturnType<typeof listPhaseOneRecords>>[number],
  event: Awaited<ReturnType<typeof listAuditTimelineEvents>>[number]
): boolean {
  const recordMarketId = readRecordMarketId(record.card);
  if (!event.marketId || !recordMarketId || recordMarketId !== event.marketId) return false;
  if (event.type === "prediction.analyzed") return record.type === "prediction.saved";
  if (event.type === "tracking.saved") return record.type === "tracking.saved";
  if (event.type === "strategy.saved") return record.type === "strategy.saved";
  if (event.type === "simulation.completed") return record.type === "simulation.saved";
  return false;
}

function readRecordMarketId(recordCard: Awaited<ReturnType<typeof listPhaseOneRecords>>[number]["card"]): string | undefined {
  if (!recordCard || typeof recordCard !== "object" || !("market" in recordCard)) return undefined;
  const market = (recordCard as { market?: unknown }).market;
  if (!market || typeof market !== "object" || !("marketId" in market)) return undefined;
  const marketId = (market as { marketId?: unknown }).marketId;
  return typeof marketId === "string" ? marketId : undefined;
}

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(),
      ...(init?.headers || {})
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-owner-user-id"
  };
}
