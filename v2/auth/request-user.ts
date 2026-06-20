import { resolveRequestUser, type AccessCheck } from "../../lib/access-control";

export type PhaseOneUserBody = {
  ownerUserId?: string;
  userId?: string;
};

export async function resolvePhaseOneUser(request: Request, body?: PhaseOneUserBody): Promise<AccessCheck & { userId: string }> {
  const queryUserId = new URL(request.url).searchParams.get("userId")?.trim() || undefined;
  const explicitUserId = body?.userId?.trim() || queryUserId || request.headers.get("x-owner-user-id")?.trim() || undefined;
  const bearerToken = getBearerToken(request);

  if (!bearerToken && requiresPrivyAccessToken()) {
    return {
      ok: false,
      status: 401,
      error: "Missing Privy access token",
      userId: ""
    };
  }

  if (!bearerToken && explicitUserId && process.env.NODE_ENV !== "production") {
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

  if (!resolved.userId) {
    return {
      ok: false,
      status: 401,
      error: "userId is required",
      userId: ""
    };
  }

  return {
    ...resolved,
    userId: resolved.userId
  };
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return undefined;
  return authorization.slice("bearer ".length).trim() || undefined;
}

function requiresPrivyAccessToken(): boolean {
  return process.env.NODE_ENV === "production" || process.env.AGENT_REQUIRE_PRIVY_TOKEN === "true";
}
