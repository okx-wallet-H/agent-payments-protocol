const AUTH_ERROR_PATTERNS = [
  "privy",
  "access token",
  "bearer token",
  "unauthorized",
  "unauthenticated",
  "jwt expired",
  "session expired",
  "login required",
  "missing authorization",
  "请重新登录"
];

export function isMobileAuthError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
    if (candidate.status === 401) return true;

    return [candidate.code, candidate.message].some((value) => containsAuthErrorText(value));
  }

  return containsAuthErrorText(error);
}

export function createFriendlyMobileSessionError(error: unknown): string | undefined {
  if (!isMobileAuthError(error)) return undefined;
  return "登录已过期，请重新登录后再试。";
}

export function createFriendlyMobileWalletNotice(notice?: string): string | undefined {
  const normalized = notice?.trim();
  if (!normalized) return undefined;
  if (isMobileAuthError(normalized)) return "登录状态正在同步，请稍后再试。";
  return normalized;
}

function containsAuthErrorText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lower = value.toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}
