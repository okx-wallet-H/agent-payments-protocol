import { Pool } from "pg";
import { getHWalletSessionStoreMode, type HWalletSessionStoreMode } from "./hwallet-postgres-session-store";
import { createPostgresClientOptions } from "./postgres-client-options";

export type V2StorageHealthStatus = "ready" | "not_configured" | "not_checked" | "error";

export interface V2StorageHealth {
  service: "hwallet-v2";
  checkedAt: string;
  sessionStore: {
    mode: HWalletSessionStoreMode;
    activeWritePath: "jsonl" | "jsonl+postgres" | "postgres";
    productionReady: boolean;
  };
  postgres: {
    configured: boolean;
    checked: boolean;
    status: V2StorageHealthStatus;
    expectedTables: number;
    presentTables: number;
    missingTables: string[];
    errorCode?: string;
  };
  warnings: string[];
}

export interface ReadV2StorageHealthOptions {
  checkPostgres?: boolean;
}

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
] as const;

export async function readV2StorageHealth(
  options: ReadV2StorageHealthOptions = {}
): Promise<V2StorageHealth> {
  const mode = getHWalletSessionStoreMode();
  const databaseUrl = process.env.DATABASE_URL;
  const postgresConfigured = Boolean(databaseUrl);
  const shouldCheckPostgres = options.checkPostgres ?? (postgresConfigured && mode !== "jsonl");
  const warnings: string[] = [];

  if (mode !== "jsonl" && !postgresConfigured) {
    warnings.push("HWALLET_SESSION_STORE requires DATABASE_URL before dual/postgres can write safely.");
  }

  if (mode === "jsonl" && postgresConfigured) {
    warnings.push("DATABASE_URL is configured, but HWallet V2 is still using local JSONL mode.");
  }

  const health: V2StorageHealth = {
    service: "hwallet-v2",
    checkedAt: new Date().toISOString(),
    sessionStore: {
      mode,
      activeWritePath: getActiveWritePath(mode),
      productionReady: false
    },
    postgres: {
      configured: postgresConfigured,
      checked: false,
      status: postgresConfigured ? "not_checked" : "not_configured",
      expectedTables: requiredTables.length,
      presentTables: 0,
      missingTables: postgresConfigured ? [] : [...requiredTables]
    },
    warnings
  };

  if (!shouldCheckPostgres || !databaseUrl) {
    health.sessionStore.productionReady = mode === "postgres" && false;
    return health;
  }

  const pool = new Pool(createPostgresClientOptions(databaseUrl));
  try {
    const presentTables = await readPresentTables(pool);
    const presentSet = new Set(presentTables);
    const missingTables = requiredTables.filter((table) => !presentSet.has(table));

    health.postgres = {
      configured: true,
      checked: true,
      status: missingTables.length === 0 ? "ready" : "error",
      expectedTables: requiredTables.length,
      presentTables: presentTables.length,
      missingTables
    };
    health.sessionStore.productionReady = mode === "postgres" && missingTables.length === 0;

    if (mode === "dual" && missingTables.length === 0) {
      warnings.push("Dual mode is for staging observation; switch to postgres only after readback is clean.");
    }
  } catch (error) {
    health.postgres = {
      configured: true,
      checked: true,
      status: "error",
      expectedTables: requiredTables.length,
      presentTables: 0,
      missingTables: [...requiredTables],
      errorCode: readPgErrorCode(error)
    };
    health.sessionStore.productionReady = false;
    warnings.push("Postgres health check failed; no secrets were included in this response.");
  } finally {
    await pool.end().catch(() => undefined);
  }

  return health;
}

async function readPresentTables(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    [
      "select table_name",
      "from information_schema.tables",
      "where table_schema = 'public' and table_name = any($1)",
      "order by table_name"
    ].join(" "),
    [[...requiredTables]]
  );

  return result.rows.map((row) => row.table_name);
}

function getActiveWritePath(mode: HWalletSessionStoreMode): V2StorageHealth["sessionStore"]["activeWritePath"] {
  if (mode === "dual") return "jsonl+postgres";
  if (mode === "postgres") return "postgres";
  return "jsonl";
}

function readPgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}
