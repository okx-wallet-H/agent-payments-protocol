import { NextResponse } from "next/server";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { createMobileAgentMemory } from "@/v2/memory/mobile-memory";
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

  const memory = await loadUserSession(user.userId);
  return jsonWithCors({
    memory: createMobileAgentMemory({
      userId: user.userId,
      memory
    })
  });
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
