# HWallet Supabase Live Closeout

Date: 2026-06-17

This closeout records the current Supabase production-data validation for the
HWallet / Agent Wallet mobile App. It is not a live-trading approval. It only
proves that the first App release can use Supabase for multi-user wallet,
Agent, memory, record, and audit state when the release gates stay closed.

## Scope

- Product body: HWallet wallet entry and Agent experience.
- Storage modes validated: `dual` and `postgres`.
- Runtime target: local Next.js server connected to the dedicated Supabase
  project through `.env.local`.
- Live execution: closed.
- Real orders, swaps, prediction trades, and transaction broadcasting: out of
  scope.

## Commands Run

Static and live Supabase closeout:

```sh
npm run smoke:supabase-closeout
npm run smoke:supabase-cutover-safety
npm run smoke:supabase-readback-drill
npm run smoke:supabase-rollback-plan
```

Dual-mode App API validation:

```sh
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-observation:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-consistency:live
```

Postgres-only App API validation:

```sh
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-performance:live
```

## Results

- `smoke:supabase-closeout`: passed in live mode with `13` HWallet tables.
- `smoke:supabase-cutover-safety`: passed.
- `smoke:supabase-readback-drill`: passed.
- `smoke:supabase-rollback-plan`: passed.
- `smoke:hwallet-dual-observation:live`: passed.
- `smoke:hwallet-dual-consistency:live`: passed.
- `smoke:hwallet-postgres-api:live`: passed.
- `smoke:hwallet-postgres-performance:live`: passed.

## What This Proves

- Supabase schema, RLS, idempotency indexes, X Layer chain constraints, and TEE
  no-export constraints are present.
- In `dual` mode, App API writes still keep the JSONL fallback path while
  mirroring wallet, transfer, message, audit, record, and memory state into
  Supabase.
- In `dual` mode, JSONL and Postgres readback agree for wallet binding,
  recharge chat, verified transfer, wallet record, tracking record, audit
  events, and Agent knowledge notes.
- In `postgres` mode, App API reads and writes wallet binding, recharge flow,
  transaction verification, tracking idempotency, memory, audit, and records
  directly through Supabase.
- Other-user isolation passed in both `dual` and `postgres` validation.
- Audit rows keep `money_moved=false` during wallet refresh, transaction
  verification, tracking, simulation, and device-evidence paths.
- Supabase pool settings stayed inside the App's safe bounds during live
  performance validation.

## Still Required

- Do not switch shared production traffic to `postgres` until the installed App
  build has passed the real-device evidence gate.
- Do not publish an EAS Update or TestFlight/internal build if the Supabase
  readback drill, staging storage summary, staging auth surface, or device
  evidence gate fails.
- Keep `HWALLET_SESSION_STORE=dual` or `jsonl` as the rollback path until the
  App release is stable.
- Keep all live execution, signing, order placement, swap, and transaction
  broadcast gates closed.

## Secret Hygiene

This file intentionally records command names, storage modes, and redacted
results only. It must not contain `DATABASE_URL`, API keys, Privy tokens,
private keys, Apple credentials, Google Play keys, verification codes, or raw
user wallet evidence.
