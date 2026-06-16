export function getUserEmailLabel(user: unknown): string | undefined {
  if (!user || typeof user !== "object") return undefined;

  const direct = user as {
    email?: string | { address?: string };
    linkedAccounts?: Array<{ type?: string; address?: string; email?: string }>;
  };
  if (typeof direct.email === "string") return direct.email;
  if (direct.email?.address) return direct.email.address;

  const linkedAccounts = Array.isArray(direct.linkedAccounts) ? direct.linkedAccounts : undefined;
  const emailAccount = linkedAccounts?.find((account) => account.type === "email");
  return emailAccount?.address || emailAccount?.email;
}

export function getHWalletUserLabel(user: unknown): string {
  return user ? getUserEmailLabel(user) || "已登录" : "未登录";
}
