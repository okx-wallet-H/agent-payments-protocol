import { verifyAccessToken } from "@privy-io/node";
import { createRemoteJWKSet } from "jose";
import type { Agent } from "./types";

export interface AccessControlStatus {
  requireOwner: boolean;
  requirePrivyToken: boolean;
  authProvider: "privy_access_token" | "owner_user_id" | "none";
  enforcement: "off" | "owner_user_id" | "privy_access_token";
  warnings: string[];
}

export interface AccessCheck {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

type RequestUserBody = { ownerUserId?: string; userId?: string };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getAccessControlStatus(): AccessControlStatus {
  const requireOwner = process.env.AGENT_REQUIRE_OWNER === "true";
  const requirePrivyToken = process.env.AGENT_REQUIRE_PRIVY_TOKEN === "true";
  const privyAppId = getPrivyAppId();
  const canVerifyPrivy = Boolean(privyAppId);
  return {
    requireOwner,
    requirePrivyToken,
    authProvider: canVerifyPrivy ? "privy_access_token" : requireOwner ? "owner_user_id" : "none",
    enforcement: requireOwner ? (requirePrivyToken ? "privy_access_token" : "owner_user_id") : "off",
    warnings: buildAccessWarnings({ requireOwner, requirePrivyToken, canVerifyPrivy })
  };
}

export function canAccessAgent(agent: Agent, providedUserId?: string): boolean {
  if (!getAccessControlStatus().requireOwner) return true;
  return Boolean(providedUserId && providedUserId === agent.ownerUserId);
}

export async function checkAgentAccess(agent: Agent, request: Request, body?: RequestUserBody): Promise<AccessCheck> {
  const status = getAccessControlStatus();
  if (!status.requireOwner) return { ok: true };

  const user = await resolveRequestUser(request, body);
  if (!user.ok) return user;
  if (user.userId !== agent.ownerUserId) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: authenticated user does not own this Agent"
    };
  }

  return { ok: true, userId: user.userId };
}

export async function resolveRequestUser(request: Request, body?: RequestUserBody): Promise<AccessCheck> {
  const accessToken = getBearerToken(request);
  if (accessToken) {
    return verifyPrivyRequestUser(accessToken);
  }

  if (process.env.AGENT_REQUIRE_PRIVY_TOKEN === "true") {
    return {
      ok: false,
      status: 401,
      error: "Missing Privy access token"
    };
  }

  const userId = getRequestUserId(request, body);
  if (!userId && process.env.AGENT_REQUIRE_OWNER === "true") {
    return {
      ok: false,
      status: 403,
      error: "ownerUserId is required when owner guard is enabled"
    };
  }

  return { ok: true, userId };
}

export function getRequestUserId(request: Request, body?: RequestUserBody): string | undefined {
  const urlUserId = new URL(request.url).searchParams.get("ownerUserId") || undefined;
  const headerUserId = request.headers.get("x-owner-user-id") || undefined;
  return body?.ownerUserId || body?.userId || headerUserId || urlUserId;
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return undefined;
  return authorization.slice("bearer ".length).trim() || undefined;
}

async function verifyPrivyRequestUser(accessToken: string): Promise<AccessCheck> {
  if (!looksLikeJwt(accessToken)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid Privy access token"
    };
  }

  const appId = getPrivyAppId();
  if (!appId) {
    return {
      ok: false,
      status: 500,
      error: "Privy App ID is not configured on the server"
    };
  }

  try {
    const verified = await verifyAccessToken({
      access_token: accessToken,
      app_id: appId,
      verification_key: getPrivyJwks(appId)
    });
    return { ok: true, userId: verified.user_id };
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Invalid Privy access token"
    };
  }
}

function looksLikeJwt(accessToken: string): boolean {
  return accessToken.split(".").length === 3;
}

function getPrivyJwks(appId: string) {
  const cached = jwksCache.get(appId);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  jwksCache.set(appId, jwks);
  return jwks;
}

function getPrivyAppId(): string | undefined {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.EXPO_PUBLIC_PRIVY_APP_ID || undefined;
}

function buildAccessWarnings(input: { requireOwner: boolean; requirePrivyToken: boolean; canVerifyPrivy: boolean }) {
  if (!input.requireOwner) {
    return ["Owner guard is disabled for local MVP development; do not expose this mode publicly."];
  }

  const warnings = [];
  if (!input.canVerifyPrivy) {
    warnings.push("Privy App ID is missing; server cannot verify Bearer access tokens.");
  }
  if (!input.requirePrivyToken) {
    warnings.push("Owner guard still accepts ownerUserId/x-owner-user-id fallback for smoke testing.");
  }
  if (input.requirePrivyToken && input.canVerifyPrivy) {
    warnings.push("Privy access token verification is required for Agent APIs.");
  }
  return warnings;
}
