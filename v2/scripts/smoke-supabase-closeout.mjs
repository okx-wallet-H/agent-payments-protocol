import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

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

const requiredIndexes = [
  "hwallet_wallet_transfers_user_tx_hash_idx",
  "hwallet_agent_records_user_idempotency_idx",
  "hwallet_agent_actions_user_idempotency_idx",
  "hwallet_tee_signers_user_ref_idx"
];

const requiredScripts = [
  "db:migrate:postgres",
  "smoke:db-schema",
  "smoke:v2-storage-health",
  "smoke:hwallet-postgres-session",
  "smoke:hwallet-postgres-session:live",
  "smoke:hwallet-dual-api:live",
  "smoke:hwallet-dual-observation:live",
  "smoke:hwallet-dual-consistency:live",
  "smoke:hwallet-postgres-api:live",
  "smoke:hwallet-postgres-performance:live",
  "smoke:audit-timeline:live",
  "smoke:phase-one-records:live",
  "smoke:agent-action-store:live",
  "smoke:market-snapshots:live",
  "smoke:supabase-cutover-safety"
];

const originalSessionStore = process.env.HWALLET_SESSION_STORE;
const checks = [];
const warnings = [];

try {
  await loadLocalDatabaseUrl();
  await checkStaticCloseout();

  if (process.env.DATABASE_URL) {
    await checkLiveSupabaseCloseout();
  } else if (process.env.SUPABASE_CLOSEOUT_REQUIRE_LIVE === "true") {
    throw new Error("DATABASE_URL is required because SUPABASE_CLOSEOUT_REQUIRE_LIVE=true.");
  } else {
    warnings.push("DATABASE_URL is not configured; live Supabase table and RLS checks were skipped.");
  }

  console.log(JSON.stringify({
    ok: true,
    mode: process.env.DATABASE_URL ? "live" : "static",
    checks,
    warnings,
    tables: requiredTables.length
  }, null, 2));
} catch (error) {
  console.error(`Supabase closeout smoke failed: ${sanitizeError(error)}`);
  process.exit(1);
} finally {
  restoreEnv("HWALLET_SESSION_STORE", originalSessionStore);
}

async function checkStaticCloseout() {
  const [schema, packageJsonRaw] = await Promise.all([
    readFile("database/schema.sql", "utf8"),
    readFile("package.json", "utf8")
  ]);
  const packageJson = JSON.parse(packageJsonRaw);
  const scripts = packageJson.scripts || {};

  for (const table of requiredTables) {
    assert(new RegExp(`create table if not exists ${table}\\b`, "i").test(schema), `schema includes ${table}`);
  }
  checks.push("schema includes all HWallet V2 tables");

  for (const table of requiredTables) {
    assert(schema.includes(`alter table ${table} enable row level security`), `schema enables RLS for ${table}`);
  }
  checks.push("schema enables RLS on all HWallet V2 tables");

  assert(schema.includes("unique (user_id, chain_id)"), "schema keeps one HWallet per user and chain");
  assert(schema.includes("money_moved boolean not null default false"), "schema defaults audit/action money movement to false");
  assert(schema.includes("export_allowed boolean not null default false check (export_allowed = false)"), "schema prevents TEE signer export");
  checks.push("schema keeps wallet uniqueness, no-money default, and TEE no-export guard");

  for (const scriptName of requiredScripts) {
    assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
  }
  checks.push("package exposes required Supabase closeout scripts");
}

async function checkLiveSupabaseCloseout() {
  const { readV2StorageHealth } = await import("../storage/storage-health.ts");

  process.env.HWALLET_SESSION_STORE = "dual";
  const dualHealth = await readV2StorageHealth({ checkPostgres: true });
  assert(dualHealth.sessionStore.mode === "dual", "dual storage mode is reported");
  assert(dualHealth.sessionStore.activeWritePath === "jsonl+postgres", "dual write path is reported");
  assert(dualHealth.postgres.status === "ready", "dual mode can see all Supabase tables");
  assert(dualHealth.postgres.missingTables.length === 0, "dual mode has no missing tables");
  checks.push("dual mode sees Supabase tables");

  process.env.HWALLET_SESSION_STORE = "postgres";
  const postgresHealth = await readV2StorageHealth({ checkPostgres: true });
  assert(postgresHealth.sessionStore.mode === "postgres", "postgres storage mode is reported");
  assert(postgresHealth.sessionStore.activeWritePath === "postgres", "postgres write path is reported");
  assert(postgresHealth.postgres.status === "ready", "postgres mode can see all Supabase tables");
  assert(postgresHealth.sessionStore.productionReady, "postgres mode is production-ready after table check");
  checks.push("postgres mode is production-ready after Supabase table check");

  const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));
  try {
    await checkLiveRls(pool);
    await checkLiveIndexes(pool);
    await checkLiveConstraints(pool);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkLiveRls(pool) {
  const result = await pool.query(
    [
      "select c.relname, c.relrowsecurity",
      "from pg_class c",
      "join pg_namespace n on n.oid = c.relnamespace",
      "where n.nspname = 'public' and c.relname = any($1)",
      "order by c.relname"
    ].join(" "),
    [requiredTables]
  );
  const rowsByName = new Map(result.rows.map((row) => [row.relname, row]));

  for (const table of requiredTables) {
    const row = rowsByName.get(table);
    assert(row, `Supabase table exists: ${table}`);
    assert(row.relrowsecurity === true, `Supabase RLS enabled: ${table}`);
  }
  checks.push("live Supabase has RLS enabled on all HWallet V2 tables");
}

async function checkLiveIndexes(pool) {
  const result = await pool.query(
    [
      "select indexname",
      "from pg_indexes",
      "where schemaname = 'public' and indexname = any($1)",
      "order by indexname"
    ].join(" "),
    [requiredIndexes]
  );
  const present = new Set(result.rows.map((row) => row.indexname));

  for (const index of requiredIndexes) {
    assert(present.has(index), `Supabase index exists: ${index}`);
  }
  checks.push("live Supabase has HWallet idempotency and signer indexes");
}

async function checkLiveConstraints(pool) {
  const result = await pool.query(
    [
      "select conname",
      "from pg_constraint",
      "where conname = any($1)",
      "order by conname"
    ].join(" "),
    [[
      "hwallet_tee_signers_export_allowed_check",
      "hwallet_wallets_chain_id_check",
      "hwallet_wallet_transfers_chain_id_check"
    ]]
  );
  const present = new Set(result.rows.map((row) => row.conname));

  assert(present.has("hwallet_tee_signers_export_allowed_check"), "Supabase keeps TEE no-export check");
  assert(present.has("hwallet_wallets_chain_id_check"), "Supabase keeps HWallet X Layer chain check");
  assert(present.has("hwallet_wallet_transfers_chain_id_check"), "Supabase keeps transfer X Layer chain check");
  checks.push("live Supabase has TEE and X Layer safety constraints");
}

async function loadLocalDatabaseUrl() {
  if (process.env.DATABASE_URL) return;

  for (const file of [".env.local", ".env"]) {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (!raw) continue;

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (key !== "DATABASE_URL") continue;

      process.env.DATABASE_URL = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      return;
    }
  }
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!process.env.DATABASE_URL) return message;
  return message
    .replaceAll(process.env.DATABASE_URL, "[DATABASE_URL]")
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://[redacted]@");
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
}
