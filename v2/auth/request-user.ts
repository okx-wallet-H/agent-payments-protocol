import { resolveRequestUser, type AccessCheck } from "@/lib/access-control";
import { DEFAULT_PHASE_ONE_USER_ID } from "../storage/phase-one-store";

export type PhaseOneUserBody = {
  ownerUserId?: string;
  userId?: string;
};

export async function resolvePhaseOneUser(request: Request, body?: PhaseOneUserBody): Promise<AccessCheck & { userId: string }> {
  const queryUserId = new URL(request.url).searchParams.get("userId")?.trim() || undefined;
  const explicitUserId = body?.userId?.trim() || queryUserId || request.headers.get("x-owner-user-id")?.trim() || undefined;

  if (!getBearerToken(request) && explicitUserId && process.env.NODE_ENV !== "production") {
    return {
      ok: true,
      userId: explicitUserId
    };
  }

  const resolved = await resolveRequestUser(request, {
    ownerUserId: body?.ownerUserId,
    userId: explicitUserId
  });

  if (!resolved.ok) {
    return {
      ...resolved,
      userId: ""
    };
  }

  return {
    ...resolved,
    userId: resolved.userId || DEFAULT_PHASE_ONE_USER_ID
  };
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return undefined;
  return authorization.slice("bearer ".length).trim() || undefined;
}
