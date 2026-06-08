# Agent Wallet Production Architecture

## Product Positioning

Agent Wallet is a transparent AI wallet for ordinary users. The user should not need to understand skills, plugins, chains, AA, or agents. The product language is:

- Tell the AI what you want.
- The AI checks public opportunities.
- The AI gives a plan first.
- TEE-backed signing keeps private keys inside a trusted execution environment.
- Onchain OS executes standardized wallet and plugin actions.
- Every step is recorded and explainable.

The implementation keeps the technical layer explicit for audit: decision trace, tool calls, policy checks, previews, confirmations, executions, memory, and training samples.

## Current MVP Stack

- Web: Next.js, React, TypeScript
- Mobile: Expo / React Native, TypeScript
- Auth and embedded wallets: Privy
- Signing security model: TEE-backed signing, private keys never leave the trusted execution environment
- Chain target: X Layer, chain id 196, OKB gas
- Onchain capabilities: OKX Onchain OS skills and plugin ecosystem
- Prediction market read path: Polymarket plugin through the Onchain OS router
- Local persistence: `data/db.json`
- Agent brain: deterministic `local-rules`
- Training data: JSONL export from chat and decision traces

## Production Stack

- App: Expo / React Native for iOS and Android
- Web console: Next.js for admin, audit, operator workflows, and training export
- API: Next.js API routes at MVP scale, split later if needed
- Database: Postgres
- Queue/cache: Redis with a job worker such as BullMQ
- Object storage: S3 or Cloudflare R2 for JSONL snapshots and replay bundles
- Vector memory: pgvector first, Qdrant later if memory search grows
- Agent brain: `local-rules` fallback plus LLM provider adapter
- Chain execution: TEE-backed signing, OKX Onchain OS router, X Layer, typed confirmation gates

## Data Roles

Postgres stores live business state:

- users
- agents
- agent memories
- messages
- runs
- intents
- previews
- confirmations
- executions
- audit events

Object storage stores append-only training and replay assets:

- daily JSONL exports
- model training snapshots
- evaluation sets
- incident replay bundles

Vector memory stores retrieval-oriented knowledge:

- user preferences
- repeated strategy hints
- summarized recent lessons
- safety preferences

Redis stores temporary and async state:

- agent job queue
- market polling jobs
- preview expiry reminders
- idempotency keys
- rate limits

## Signing Rule

Private keys must never enter the chat layer, app server logs, browser runtime, or agent memory. Signing is handled inside a TEE-backed execution layer. The Agent creates policy-scoped execution requests and records the decision trail; it does not custody, export, or reconstruct private keys.

## Execution Rule

No chat message can directly become a transaction.

Every execution path must pass:

1. Intent creation
2. Policy check
3. Execution preview
4. Fresh preview validation
5. Typed confirmation for live writes
6. Audit event
7. Execution or simulation record

## Memory Rule

Memory should have immediate product effect, but remain transparent and controllable:

- Users can ask what the AI remembers.
- Users can view memory JSON.
- Users can reset memory.
- Memory can influence defaults such as comfortable amount and explanation style.
- Memory cannot bypass policy, preview, or confirmation.

## Training Rule

Training data should capture behavior, not just chat text:

- user message
- agent status
- memory snapshot
- policy snapshot
- decision trace
- tool calls
- tool result
- assistant message
- safety labels

The default export format is JSONL, one example per line.

## Migration Path

1. Keep local `data/db.json` for MVP speed.
2. Add a Postgres-backed store implementing the same Agent shape.
3. Write both JSON and Postgres for one release in staging.
4. Switch reads to Postgres after diff checks pass.
5. Move JSONL exports from API response only to object storage snapshots.
6. Add vector memory only after enough real memory entries exist.
