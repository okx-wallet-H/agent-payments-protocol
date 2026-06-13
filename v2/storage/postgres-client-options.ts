export interface HWalletPostgresClientOptions {
  connectionString: string;
  ssl?: {
    rejectUnauthorized: boolean;
  };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export function createPostgresClientOptions(connectionString: string): HWalletPostgresClientOptions {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required before creating a Postgres client.");
  }

  const relaxedSsl = shouldUseRelaxedSsl(connectionString);

  return {
    connectionString: relaxedSsl ? removeSslMode(connectionString) : connectionString,
    ssl: relaxedSsl ? { rejectUnauthorized: false } : undefined,
    max: readPoolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000
  };
}

function readPoolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX || "2");
  if (!Number.isFinite(configured) || configured < 1) return 2;
  return Math.min(Math.floor(configured), 5);
}

function shouldUseRelaxedSsl(connectionString: string): boolean {
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false") return true;

  try {
    const parsed = new URL(connectionString);
    return parsed.hostname.endsWith(".pooler.supabase.com");
  } catch {
    return connectionString.includes(".pooler.supabase.com");
  }
}

function removeSslMode(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return connectionString.replace(/[?&]sslmode=[^&]+/, (match) => (match.startsWith("?") ? "?" : ""));
  }
}
