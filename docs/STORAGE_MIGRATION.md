# Storage Migration Plan

The MVP currently uses `data/db.json`, wrapped by `lib/store.ts`.

`lib/store.ts` now exposes an `AgentStore` interface so API routes do not need to know whether persistence is JSON, Postgres, or another backend.

## Current Store

- Provider: JSON file
- Location: `data/db.json`
- Good for: local MVP, demos, deterministic testing
- Not good for: concurrent production writes, real money, multi-instance deployments
- Health check: `GET /api/system/storage`
- Writes are atomic at the file level: write temp file, then rename.
- If `DATABASE_URL` is set but `AGENT_STORE` is not `postgres`, the app still reports JSON storage with a warning.

## Production Store

Target: Postgres using `database/schema.sql`.

V2 HWallet tables are included in the same migration file. See
`docs/HWALLET_DATABASE_DESIGN.md` for the mobile wallet, session, action,
audit, market snapshot, and future TEE signer tables.

Current status: the HWallet schema was first verified in the temporary Supabase
project `H-wallet-agent` (`qybhqwituytwuzvwsike`). The standalone production
target is now `Agent-Wallet-Production` (`actzwcgxwejiodsgwmpf`), and local
`.env.local` points to that project through the Supabase Session pooler. The V2
HWallet session adapter is available behind `HWALLET_SESSION_STORE`.

As of 2026-06-13, `database/schema.sql` has been applied to
`Agent-Wallet-Production` and the live HWallet session smoke test passed:
temporary user creation, wallet binding, asset snapshot, verified transfer,
Agent messages, wallet records, and knowledge notes all wrote to Postgres and
read back successfully.

The mobile API dual-write path also passed a live smoke test:
`HWALLET_SESSION_STORE=dual` server writes through `/api/v2/mobile/home`,
`/api/v2/phase-one`, `/api/v2/mobile/wallet/refresh`, and
`/api/v2/mobile/wallet/verify-tx`, then the script reads the same user back from
Postgres to confirm wallet binding, messages, verified transfer, records,
knowledge notes, and user isolation.

The audit timeline store now follows the same staged switch. In `jsonl` mode it
keeps local behavior. In `dual` mode it appends local JSONL and mirrors audit
events into `hwallet_audit_events`. In `postgres` mode it reads audit events
from Supabase. The live smoke confirms wallet transfer audit fields, simulation
metadata, `money_moved=false`, newest-first ordering, and user isolation.

The phase-one record store now follows the same staged switch. In `jsonl` mode
it keeps `.agent-wallet-data/phase-one-records.jsonl`. In `dual` mode it keeps
local writes and mirrors prediction/tracking/strategy/simulation cards into
`hwallet_agent_records`. In `postgres` mode it reads and writes those cards from
Supabase. The live smoke confirms card restore, idempotency, newest-first
ordering, and user isolation.

Agent run/action storage now follows the same staged switch. In `jsonl` mode it
keeps `.agent-wallet-data/agent-runs.jsonl` and
`.agent-wallet-data/agent-actions.jsonl`. In `dual` mode it mirrors Agent
intent, action, capability gate, policy result, and `money_moved=false` into
`hwallet_agent_runs` and `hwallet_agent_actions`. In `postgres` mode it reads
those records from Supabase.

Market snapshot storage now follows the same staged switch. In `jsonl` mode it
keeps `.agent-wallet-data/market-snapshots.jsonl`. In `dual` mode it mirrors
OKX, plugin, and sample market snapshots into `hwallet_market_snapshots`. In
`postgres` mode it reads recent market snapshots from Supabase. The World Cup
explore route captures snapshots without blocking the page response if the
snapshot write fails.

V2 HWallet modes:

- `HWALLET_SESSION_STORE=jsonl`: default local mode; no Supabase dependency.
- `HWALLET_SESSION_STORE=dual`: read from JSONL, mirror session/wallet data into Supabase.
- `HWALLET_SESSION_STORE=postgres`: read and write HWallet session/wallet data through Supabase.

`dual` and `postgres` require `DATABASE_URL`.

Supabase session pooler has a small connection ceiling on the current project.
The app therefore uses a conservative Postgres pool by default:
`DATABASE_POOL_MAX=2`, capped at `5` if overridden. Keep this low for staging
unless the Supabase pool size is raised or the deployment switches to a pooler
mode that supports higher concurrency.

The future Postgres implementation should satisfy:

```ts
interface AgentStore {
  readDb(): Promise<Database>;
  writeDb(db: Database): Promise<void>;
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  saveAgent(agent: Agent, event?: AuditEvent): Promise<Agent>;
  addAudit(event: AuditEvent): Promise<void>;
  listAudit(agentId: string): Promise<AuditEvent[]>;
}
```

## Migration Steps

1. Run `npm run db:migrate:postgres -- --dry-run` to validate the migration file locally.
1. Run `npm run smoke:db-schema` to confirm HWallet production tables and safety indexes are present.
2. Apply `database/schema.sql` to a Postgres 15+ database with `DATABASE_URL=... npm run db:migrate:postgres`.
3. Set `DATABASE_URL`.
4. Set `AGENT_STORE=postgres` to opt into the Postgres adapter.
5. Verify `GET /api/system/storage` reports `provider: "postgres"`.
6. Run `npm run smoke:mvp` against the Postgres-backed API.
7. Run dual writes in staging if needed: JSON plus Postgres.
8. Compare API outputs from both stores.
9. Switch reads to Postgres.
10. Disable JSON writes in production.

For V2 HWallet, run the safer staged switch:

1. Keep `HWALLET_SESSION_STORE=jsonl` during normal development.
2. Set `HWALLET_SESSION_STORE=dual` with `DATABASE_URL` and run wallet login, recharge verification, and chat turns.
3. Confirm `GET /api/v2/system/storage` reports the expected mode and table readiness without exposing any secrets.
4. Compare `.agent-wallet-data/user-sessions.jsonl` with Supabase rows in `hwallet_wallets`, `hwallet_wallet_assets`, `hwallet_wallet_transfers`, `hwallet_agent_sessions`, `hwallet_agent_messages`, and `hwallet_agent_records`.
5. Set `HWALLET_SESSION_STORE=postgres` only after the dual-write comparison is clean.

V2 storage health smoke command:

```bash
npm run smoke:v2-storage-health
```

Live dual API smoke command:

```bash
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-api:live
```

Live dual observation command:

```bash
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-observation:live
```

Use this before real-device observation. It verifies the user-facing App APIs and the Postgres mirror in the same run: wallet binding, recharge conversation, tx verification, tracking record, memory endpoint, audit endpoint, records endpoint, and user isolation.

Live dual consistency command:

```bash
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-consistency:live
```

Use this after the dual observation smoke. It compares the JSONL read path with
the Supabase mirror for the same user and same action: wallet binding, recharge
chat, verified transfer, wallet record, tracking record, audit events,
`money_moved=false`, knowledge notes, idempotency, and user isolation.

Live Postgres-only API command:

```bash
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
```

Use this only after the dual observation is clean. It verifies the same App-facing path while reads and writes go through Supabase directly.

## Cutover Safety Gate

Do not switch a shared environment to `HWALLET_SESSION_STORE=postgres` only because
the schema exists. Treat the switch as a cutover with an explicit rollback path:

1. Keep the current App build and API release pinned before the storage switch.
2. Run the static gate:

```bash
npm run smoke:supabase-cutover-safety
```

3. Run the live structure gate:

```bash
npm run smoke:supabase-closeout
```

4. Run staging in `dual` first:

```bash
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-observation:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-consistency:live
```

5. Confirm the dual consistency gate is clean before changing the read path.
If JSONL and Supabase disagree for wallet binding, transfer history, Agent
records, audit events, or user isolation, keep `dual` mode and investigate the
affected user before continuing.

6. Create a database backup before changing the read path. Use a managed
Supabase backup when available, or a local encrypted dump with a placeholder
connection string:

```bash
pg_dump "$DATABASE_URL" --format=custom --file ./private-backups/hwallet-before-postgres-cutover.dump
```

The backup directory must stay outside Git. Never paste the real `DATABASE_URL`
into docs, logs, issue comments, or PR text.

7. Switch one staging environment to `postgres` and run the App-facing readback:

```bash
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
```

8. Run the postgres performance gate before promoting the switch beyond staging:

```bash
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-performance:live
```

The default performance thresholds are intentionally conservative for early
Supabase pooler testing: core write endpoints must finish within 25 seconds,
read endpoints within 10 seconds, and the full smoke within 120 seconds. Tighten
`HWALLET_POSTGRES_PERF_MAX_ENDPOINT_MS`,
`HWALLET_POSTGRES_PERF_MAX_READ_ENDPOINT_MS`, and
`HWALLET_POSTGRES_PERF_MAX_TOTAL_MS` before a public launch.

9. Roll back immediately if login, wallet binding, recharge, tx verification,
Agent memory, audit, or record readback fails:

```bash
HWALLET_SESSION_STORE=dual
# or, for local emergency fallback:
HWALLET_SESSION_STORE=jsonl
```

After rollback, keep real execution disabled, preserve the failing request id /
audit id, and compare the affected user rows against the JSONL fallback before
trying the cutover again.

Live audit timeline smoke command:

```bash
npm run smoke:audit-timeline:live
```

Live phase-one records smoke command:

```bash
npm run smoke:phase-one-records:live
```

Live Agent run/action smoke command:

```bash
npm run smoke:agent-action-store:live
```

Live market snapshots smoke command:

```bash
npm run smoke:market-snapshots:live
```

## Important Rule

Store migration must not change Agent behavior. Chat, memory, preview, confirmation, execution, audit, and training export should continue using the same exported store functions.
