import { NextResponse } from "next/server";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { saveAuditTimelineEvent } from "@/v2/storage/audit-timeline-store";

export const runtime = "nodejs";

interface DeviceEvidenceBody {
  userId?: string;
  ownerUserId?: string;
  walletAddress?: string;
  environment?: {
    platform?: string;
    buildChannel?: string;
    apiBaseUrl?: string;
    appVersion?: string;
    buildNumber?: string;
  };
  checks?: Partial<Record<DeviceEvidenceCheckName, boolean>>;
  artifacts?: Array<{
    label?: string;
    redacted?: boolean;
  }>;
}

type DeviceEvidenceCheckName =
  | "appOpensWithoutCrash"
  | "hWalletVisible"
  | "receiveAddressVisible"
  | "copyFeedbackVisible"
  | "noWrongUserDataExposure"
  | "liveExecutionClosed";

const requiredChecks: DeviceEvidenceCheckName[] = [
  "appOpensWithoutCrash",
  "hWalletVisible",
  "receiveAddressVisible",
  "copyFeedbackVisible",
  "noWrongUserDataExposure",
  "liveExecutionClosed"
];

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DeviceEvidenceBody;
  const user = await resolvePhaseOneUser(request, body);
  if (!user.ok) {
    return jsonWithCors({ error: user.error }, { status: user.status || 401 });
  }

  const checks = normalizeChecks(body.checks);
  const missingChecks = requiredChecks.filter((checkName) => checks[checkName] !== true);
  if (missingChecks.length > 0) {
    return jsonWithCors({
      error: "device_evidence_incomplete",
      message: "真机验证还没有完成，请在 App 内复制一次收款地址后再提交。",
      missingChecks
    }, { status: 400 });
  }

  const walletAddress = normalizeWalletAddress(body.walletAddress);
  const environment = normalizeEnvironment(body.environment);
  const artifacts = normalizeArtifacts(body.artifacts);
  const event = await saveAuditTimelineEvent({
    userId: user.userId,
    type: "device.evidence",
    title: "真机验证已记录",
    note: createEvidenceNote({ environment, walletAddress, artifactCount: artifacts.length }),
    status: "success",
    chainId: 196,
    assetSymbol: "HWallet",
    amountLabel: "copy-feedback-visible"
  });

  return jsonWithCors({
    ok: true,
    evidence: {
      id: event.id,
      userId: event.userId,
      title: event.title,
      createdAt: event.createdAt,
      redacted: true,
      walletAddress: walletAddress ? shortAddress(walletAddress) : undefined,
      environment,
      checks,
      artifacts
    }
  }, { status: 201 });
}

function normalizeChecks(checks: DeviceEvidenceBody["checks"]): Record<DeviceEvidenceCheckName, boolean> {
  return Object.fromEntries(requiredChecks.map((checkName) => [checkName, checks?.[checkName] === true])) as Record<
    DeviceEvidenceCheckName,
    boolean
  >;
}

function normalizeEnvironment(environment: DeviceEvidenceBody["environment"]) {
  return {
    platform: trimText(environment?.platform, 24) || "unknown",
    buildChannel: trimText(environment?.buildChannel, 40) || "unknown",
    apiBaseUrl: normalizeApiBaseUrl(environment?.apiBaseUrl),
    appVersion: trimText(environment?.appVersion, 32) || "unknown",
    buildNumber: trimText(environment?.buildNumber, 32) || "unknown"
  };
}

function normalizeArtifacts(artifacts: DeviceEvidenceBody["artifacts"]) {
  return (artifacts || [])
    .slice(0, 8)
    .map((artifact) => ({
      label: trimText(artifact.label, 80) || "redacted-device-artifact",
      redacted: artifact.redacted === true
    }))
    .filter((artifact) => artifact.redacted);
}

function createEvidenceNote(input: {
  environment: ReturnType<typeof normalizeEnvironment>;
  walletAddress?: `0x${string}`;
  artifactCount: number;
}) {
  const parts = [
    "HWallet 真机证据已记录：收款地址可见、复制反馈可见、多用户隔离未发现串号、真实执行保持关闭。",
    `设备 ${input.environment.platform} / ${input.environment.buildChannel}。`
  ];
  if (input.walletAddress) parts.push(`地址 ${shortAddress(input.walletAddress)}。`);
  if (input.artifactCount > 0) parts.push(`已附 ${input.artifactCount} 个脱敏凭证标签。`);
  return parts.join(" ");
}

function normalizeApiBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function normalizeWalletAddress(value: unknown): `0x${string}` | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return undefined;
  return normalized as `0x${string}`;
}

function shortAddress(value: `0x${string}`): string {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function trimText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
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
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-owner-user-id"
  };
}
