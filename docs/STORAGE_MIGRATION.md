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
2. Apply `database/schema.sql` to a Postgres 15+ database with `DATABASE_URL=... npm run db:migrate:postgres`.
3. Set `DATABASE_URL`.
4. Set `AGENT_STORE=postgres` to opt into the Postgres adapter.
5. Verify `GET /api/system/storage` reports `provider: "postgres"`.
6. Run `npm run smoke:mvp` against the Postgres-backed API.
7. Run dual writes in staging if needed: JSON plus Postgres.
8. Compare API outputs from both stores.
9. Switch reads to Postgres.
10. Disable JSON writes in production.

## Important Rule

Store migration must not change Agent behavior. Chat, memory, preview, confirmation, execution, audit, and training export should continue using the same exported store functions.
