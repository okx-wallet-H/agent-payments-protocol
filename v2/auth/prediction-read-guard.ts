import { resolvePhaseOneUser } from "./request-user";

type PredictionReadGuardOptions = {
  route: "world-cup-explore" | "prediction-explore" | "prediction-detail" | "prediction-status";
  limit?: number;
  windowMs?: number;
};

type PredictionReadGuardOk = {
  ok: true;
  userId: string;
  headers: Record<string, string>;
};

type PredictionReadGuardRejected = {
  ok: false;
  status: number;
  body: {
    error: string;
    message: string;
  };
  headers: Record<string, string>;
};

type PredictionReadBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;
const buckets = new Map<string, PredictionReadBucket>();

export async function guardPredictionReadRequest(
  request: Request,
  options: PredictionReadGuardOptions
): Promise<PredictionReadGuardOk | PredictionReadGuardRejected> {
  const user = await resolvePhaseOneUser(request);
  if (!user.ok) {
    return {
      ok: false,
      status: user.status || 401,
      body: {
        error: user.error || "Unauthorized",
        message: "登录状态正在同步，请稍后再试。"
      },
      headers: {
        "cache-control": "no-store"
      }
    };
  }

  const limit = readPositiveInteger(process.env.PREDICTION_READ_RATE_LIMIT, options.limit || DEFAULT_LIMIT);
  const windowMs = readPositiveInteger(process.env.PREDICTION_READ_RATE_WINDOW_MS, options.windowMs || DEFAULT_WINDOW_MS);
  const now = Date.now();
  const key = `${options.route}:${user.userId || clientFingerprint(request)}`;
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const headers = {
    "cache-control": "private, max-age=15",
    "x-hwallet-read-scope": "prediction-market-readonly",
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(Math.ceil(bucket.resetAt / 1000))
  };

  if (bucket.count > limit) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "prediction_read_rate_limited",
        message: `查询太频繁了，约 ${resetSeconds} 秒后再试。`
      },
      headers: {
        ...headers,
        "retry-after": String(resetSeconds)
      }
    };
  }

  return {
    ok: true,
    userId: user.userId,
    headers
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientFingerprint(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim();
  return [forwardedFor || realIp || "unknown-ip", userAgent || "unknown-agent"].join(":");
}
