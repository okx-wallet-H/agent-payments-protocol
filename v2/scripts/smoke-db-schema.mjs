import { readFile } from "node:fs/promises";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "database", "schema.sql");
const sql = await readFile(schemaPath, "utf8");

const requiredTables = [
  "app_users",
  "hwallet_wallets",
  "hwallet_wallet_assets",
  "hwallet_wallet_transfers",
  "hwallet_agent_sessions",
  "hwallet_agent_messages",
  "hwallet_agent_memory_items",
  "hwallet_agent_records",
  "hwallet_agent_runs",
  "hwallet_agent_actions",
  "hwallet_audit_events",
  "hwallet_market_snapshots",
  "hwallet_tee_signers"
];

const requiredSnippets = [
  "unique (user_id, chain_id)",
  "hwallet_wallet_transfers_user_tx_hash_idx",
  "on hwallet_wallet_transfers(user_id, lower(tx_hash))",
  "hwallet_agent_records_user_idempotency_idx",
  "where idempotency_key is not null",
  "money_moved boolean not null default false",
  "export_allowed boolean not null default false check (export_allowed = false)",
  "provider text not null check (provider in ('okx-outcomes', 'polymarket-plugin', 'local-sample'))",
  "alter table app_users enable row level security",
  "alter table hwallet_wallets enable row level security",
  "alter table hwallet_agent_sessions enable row level security",
  "alter table hwallet_audit_events enable row level security",
  "alter table hwallet_tee_signers enable row level security"
];

for (const table of requiredTables) {
  assert(
    new RegExp(`create table if not exists ${table}\\b`, "i").test(sql),
    `missing table ${table}`
  );
}

for (const snippet of requiredSnippets) {
  assert(sql.includes(snippet), `missing schema guard: ${snippet}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: "database/schema.sql",
  checks: [
    "V2 HWallet tables present",
    "wallet binding uniqueness present",
    "transfer idempotency present",
    "record/action idempotency present",
    "audit money_moved default false present",
    "TEE signer never-export guard present",
    "market snapshot provider guard present",
    "Supabase RLS default-deny boundary present"
  ],
  tables: requiredTables.length
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Database schema smoke failed: ${label}`);
}
