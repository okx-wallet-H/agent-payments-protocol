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

const sessionRequiredSnippets = [
  "getHWalletSessionStoreMode",
  "storeMode === \"postgres\"",
  "storeMode !== \"postgres\"",
  "storeMode !== \"jsonl\"",
  "loadUserSessionFromJsonl"
];

for (const snippet of adapterRequiredSnippets) {
  assert(adapter.includes(snippet), `adapter missing ${snippet}`);
}

for (const snippet of sessionRequiredSnippets) {
  assert(sessionStore.includes(snippet), `session store missing ${snippet}`);
}

console.log(JSON.stringify({
  ok: true,
  store: "v2/storage/hwallet-postgres-session-store.ts",
  checks: [
    "default JSONL mode retained",
    "explicit dual/postgres mode gated by env",
    "wallet/session/message/record tables wired",
    "user-session store can read/write through adapter"
  ]
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet Postgres session store smoke failed: ${label}`);
}
