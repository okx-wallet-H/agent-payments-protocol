const originalMode = process.env.HWALLET_SESSION_STORE;
const originalLegacyMode = process.env.HWALLET_STORE;
const originalDatabaseUrl = process.env.DATABASE_URL;

const { readV2StorageHealth } = await import("../storage/storage-health.ts");

try {
  delete process.env.DATABASE_URL;
  delete process.env.HWALLET_STORE;
  process.env.HWALLET_SESSION_STORE = "jsonl";

  const localHealth = await readV2StorageHealth({ checkPostgres: false });
  assert(localHealth.service === "hwallet-v2", "reports v2 service");
  assert(localHealth.sessionStore.mode === "jsonl", "jsonl is defaultable");
  assert(localHealth.sessionStore.activeWritePath === "jsonl", "jsonl write path is reported");
  assert(localHealth.postgres.status === "not_configured", "missing postgres is explicit");
  assert(!localHealth.sessionStore.productionReady, "jsonl is not production ready");

  process.env.HWALLET_SESSION_STORE = "dual";
  const missingDbHealth = await readV2StorageHealth({ checkPostgres: false });
  assert(missingDbHealth.sessionStore.mode === "dual", "dual mode is reported");
  assert(missingDbHealth.sessionStore.activeWritePath === "jsonl+postgres", "dual write path is reported");
  assert(
    missingDbHealth.warnings.some((warning) => warning.includes("DATABASE_URL")),
    "dual mode warns when DATABASE_URL is missing"
  );

  process.env.HWALLET_SESSION_STORE = "postgres";
  process.env.DATABASE_URL = "postgresql://example.invalid/hwallet";
  const uncheckedHealth = await readV2StorageHealth({ checkPostgres: false });
  assert(uncheckedHealth.postgres.configured, "postgres configuration is detected");
  assert(uncheckedHealth.postgres.status === "not_checked", "postgres check can be skipped safely");
  assert(uncheckedHealth.sessionStore.activeWritePath === "postgres", "postgres write path is reported");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "reports HWallet V2 storage service",
      "reports local jsonl mode",
      "warns when dual mode lacks DATABASE_URL",
      "detects postgres configuration without printing secrets",
      "keeps productionReady false outside checked postgres mode"
    ]
  }, null, 2));
} finally {
  restoreEnv("HWALLET_SESSION_STORE", originalMode);
  restoreEnv("HWALLET_STORE", originalLegacyMode);
  restoreEnv("DATABASE_URL", originalDatabaseUrl);
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function assert(condition, label) {
  if (!condition) throw new Error(`V2 storage health smoke failed: ${label}`);
}
