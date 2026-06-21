import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const adapterPath = path.join(root, "v2", "storage", "hwallet-postgres-session-store.ts");
const sessionStorePath = path.join(root, "v2", "storage", "user-session-store.ts");

const [adapter, sessionStore] = await Promise.all([
  readFile(adapterPath, "utf8"),
  readFile(sessionStorePath, "utf8")
]);

const adapterRequiredSnippets = [
  "HWALLET_SESSION_STORE",
  "HWALLET_STORE",
  "return \"jsonl\"",
  "writeUserSessionToPostgres",
  "loadUserSessionFromPostgres",
  "hwallet_wallets",
  "hwallet_wallet_assets",
  "hwallet_wallet_transfers",
  "hwallet_agent_sessions",
  "hwallet_agent_messages",
  "hwallet_agent_records",
  "hwallet_agent_memory_items"
];

const compactAdapter = adapter.replace(/["`,]/g, " ").replace(/\s+/g, " ");
const sessionWritePath = sessionStore.slice(
  sessionStore.indexOf("export async function bindUserWalletSession"),
  sessionStore.indexOf("export function getWalletAddressConflict")
);
const adapterIsolationPatterns = [
  [
    /from hwallet_wallets where user_id = \$1 and chain_id = 196 and status <> 'revoked'/,
    "wallet lookup is scoped by user and chain"
  ],
  [
    /from hwallet_agent_sessions where user_id = \$1 order by case when status = 'active'/,
    "agent session lookup is scoped by user"
  ],
  [
    /on conflict \(user_id chain_id\) do update set/,
    "wallet upsert is unique per user and chain"
  ],
  [
    /on conflict \(user_id lower\(tx_hash\)\) do update set/,
    "verified transfer idempotency is scoped by user and tx hash"
  ],
  [
    /from hwallet_wallet_transfers where user_id = \$1 and wallet_id = \$2 order by verified_at desc/,
    "verified transfer read is scoped by user and wallet"
  ],
  [
    /from hwallet_agent_messages where user_id = \$1 and session_id = \$2 and role in/,
    "message read is scoped by user and session"
  ],
  [
    /from hwallet_agent_records where user_id = \$1 order by created_at desc/,
    "wallet record read is scoped by user"
  ],
  [
    /on conflict \(user_id idempotency_key\) where idempotency_key is not null/,
    "wallet record idempotency is scoped by user"
  ],
  [
    /from hwallet_agent_memory_items where user_id = \$1 and memory_type = 'knowledge_note'/,
    "knowledge note read is scoped by user"
  ],
  [
    /where user_id = \$1 and memory_type = 'knowledge_note' and lower\(content\) = lower\(\$3\)/,
    "knowledge note de-duplication is scoped by user"
  ]
];

const sessionRequiredSnippets = [
  "getHWalletSessionStoreMode",
  "storeMode === \"postgres\"",
  "storeMode !== \"postgres\"",
  "storeMode !== \"jsonl\"",
  "loadUserSessionFromJsonl",
  "requireUserSessionUserId",
  "User session userId is required"
];

for (const snippet of adapterRequiredSnippets) {
  assert(adapter.includes(snippet), `adapter missing ${snippet}`);
}

for (const snippet of sessionRequiredSnippets) {
  assert(sessionStore.includes(snippet), `session store missing ${snippet}`);
}

for (const [pattern, label] of adapterIsolationPatterns) {
  assert(pattern.test(compactAdapter), label);
}

assert(!sessionWritePath.includes('userId: input.userId,'), "session writes use normalized required user id");
assert(
  !sessionWritePath.includes('userId: input.userId || "demo-user"'),
  "session writes do not fall back to demo-user"
);

const originalStoreMode = process.env.HWALLET_SESSION_STORE;
try {
  process.env.HWALLET_SESSION_STORE = "jsonl";
  const { bindUserWalletSession, rememberUserSession } = await import("../storage/user-session-store.ts");
  const missingRememberUserRejected = await rejectsMissingUser(() => rememberUserSession({
    userId: "",
    homeLoad: true
  }));
  const missingBindUserRejected = await rejectsMissingUser(() => bindUserWalletSession({
    userId: "   ",
    walletAddress: `0x${"1".repeat(40)}`
  }));

  assert(missingRememberUserRejected, "remember session rejects missing user id");
  assert(missingBindUserRejected, "bind wallet session rejects missing user id");
} finally {
  restoreEnv("HWALLET_SESSION_STORE", originalStoreMode);
}

console.log(JSON.stringify({
  ok: true,
  store: "v2/storage/hwallet-postgres-session-store.ts",
  checks: [
    "default JSONL mode retained",
    "explicit dual/postgres mode gated by env",
    "wallet/session/message/record tables wired",
    "user-session store can read/write through adapter",
    "wallet/session/record/transfer/memory SQL remains user scoped",
    "session writes require a user id",
    "missing user session writes are rejected"
  ]
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet Postgres session store smoke failed: ${label}`);
}

async function rejectsMissingUser(callback) {
  try {
    await callback();
    return false;
  } catch (error) {
    return error instanceof Error && error.message === "User session userId is required";
  }
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
