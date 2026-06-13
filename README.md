# Agent Wallet X Layer MVP

Conversation-first Agent Wallet for ordinary community users. The user talks to a dedicated AI Agent, HWallet handles the wallet boundary, the Agent reads market opportunities, prepares cards, handles wallet-facing operations behind the scenes, and records the work.

The current product direction is locked in `docs/PROJECT_EXECUTION_PLAN.md`.

First-stage consolidation status is recorded in `docs/PHASE_ONE_CLOSEOUT.md`.

## Current Stack

- Web: Next.js, React, TypeScript
- Mobile: Expo / React Native, TypeScript
- Auth and embedded wallet: Privy
- Chain target: X Layer, chain id 196, OKB gas
- Onchain capability layer: OKX Onchain OS skills and plugin router
- Prediction market source: Polymarket plugin
- Local persistence: ignored runtime JSON files
- Optional production store adapter: Postgres via `AGENT_STORE=postgres`
- Storage health: `GET /api/system/storage`
- Access-control health: `GET /api/system/auth`
- Agent brain: deterministic `local-rules`
- Training export: JSONL

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Run the MVP smoke path:

```bash
npm run smoke:mvp
```

Run the V2 mobile-Agent smoke paths:

```bash
npm run smoke:v2
npm run smoke:v2:auth
```

Validate the Postgres migration file without connecting to a database:

```bash
npm run db:migrate:postgres -- --dry-run
```

This verifies Agent creation, Agent Vault binding, prediction intent creation, safety preview, 6-digit confirmation, simulated execution, and audit records through the HTTP API. It also checks the first safety failure paths: over-budget blocking, paused Agent blocking, and confirmation-code lockout. Local smoke data is cleaned up by default; use `npm run smoke:mvp -- --keep-data` to preserve the created Agent.

Mobile:

```bash
npm run mobile:dev
```

Mobile V2 shell:

```bash
npm run mobile:dev:v2
```

## Safety Model

The chat layer cannot directly move funds. Every money-moving path must pass:

1. intent
2. policy check
3. preview
4. fresh preview validation
5. typed confirmation for live writes
6. audit
7. execution or simulation record

## Phase 1 Acceptance

Phase 1 is considered complete when `npm run smoke:mvp`, `npm run typecheck`, `npm run mobile:typecheck`, and `npm run build` all pass.

For the current mobile-first HWallet line, run the full merge gate before every commit or push:

```bash
npm run verify:merge
```

The current V2 upload gate is:

```bash
npm run mobile:typecheck
npm run smoke:v2
npm run smoke:v2:auth
npm run typecheck
npm run build
```

Current Phase 1 scope:

- Privy-ready user login and embedded wallet wiring
- Agent creation and Agent Vault binding
- Polymarket plugin prediction intent path
- Policy checks for amount, budget, status, market, vault, and expiry
- Storage health endpoint and atomic local JSON writes
- Safety preview with plain-language summary
- 6-digit confirmation with lockout after repeated failures
- Simulated execution while live trading gates are disabled
- Audit records for creation, vault, intent, preview, confirmation, execution, and blocks
- Web and Expo mobile clients sharing the same backend contract

## Important Files

- `docs/PROJECT_EXECUTION_PLAN.md`: phase-by-phase upload and release plan
- `docs/V2_API_CONTRACT.md`: V2 mobile/backend API contract
- `docs/V2_RELEASE_CHECKLIST.md`: V2 release checklist
- `lib/agent-chat.ts`: conversational brain and decision routing
- `lib/agent-execution.ts`: shared preview and execution safety path
- `lib/agent-memory.ts`: transparent memory and real-time feedback loop
- `lib/agent-training.ts`: JSONL training sample builder
- `lib/onchainos-router.ts`: Onchain OS plugin router metadata
- `docs/PRODUCTION_ARCHITECTURE.md`: production architecture plan
- `database/schema.sql`: Postgres schema draft

## Production Direction

Keep the frontend simple for ordinary users:

- "Tell AI what you want"
- "AI gives a plan first"
- "You confirm before funds can move"
- "Every action is visible and recorded"

Keep the backend transparent for audit:

- decision trace
- tool calls
- policy checks
- previews
- confirmations
- executions
- memory
- training samples
