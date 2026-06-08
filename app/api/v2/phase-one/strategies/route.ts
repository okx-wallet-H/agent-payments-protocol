import { NextResponse } from "next/server";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { listStrategyCards } from "@/v2/storage/phase-one-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolvePhaseOneUser(request);
  if (!user.ok) {
    return NextResponse.json({ error: user.error }, { status: user.status || 401 });
  }

  return NextResponse.json({
    items: await listStrategyCards(user.userId)
  });
}
