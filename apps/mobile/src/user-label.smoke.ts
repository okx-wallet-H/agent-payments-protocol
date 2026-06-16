import { getHWalletUserLabel, getUserEmailLabel } from "./user-label";

const checks: string[] = [];

assert(getUserEmailLabel(undefined) === undefined, "undefined user has no email label");
assert(getUserEmailLabel(null) === undefined, "null user has no email label");
assert(getHWalletUserLabel(undefined) === "未登录", "undefined user gets signed-out fallback");
assert(getHWalletUserLabel(null) === "未登录", "null user gets signed-out fallback");
assert(getHWalletUserLabel({ id: "did:privy:test" }) === "已登录", "logged-in user without email gets safe fallback");

assert(
  getUserEmailLabel({ email: { address: "owner@example.com" } }) === "owner@example.com",
  "Privy email object address is used"
);
assert(getUserEmailLabel({ email: "string@example.com" }) === "string@example.com", "string email is used");
assert(
  getUserEmailLabel({
    linkedAccounts: [
      { type: "wallet", address: "0x1111111111111111111111111111111111111111" },
      { type: "email", address: "linked@example.com" }
    ]
  }) === "linked@example.com",
  "linked account email address is used"
);
assert(
  getUserEmailLabel({
    linkedAccounts: [{ type: "email", email: "linked-email-field@example.com" }]
  }) === "linked-email-field@example.com",
  "linked account email field is used"
);
assert(
  getUserEmailLabel({ email: {}, linkedAccounts: "not-an-array" }) === undefined,
  "malformed linked accounts stay safe"
);

console.log(JSON.stringify({ ok: true, checks }, null, 2));

function assert(condition: unknown, label: string) {
  if (!condition) throw new Error(`Mobile user label smoke failed: ${label}`);
  checks.push(label);
}
