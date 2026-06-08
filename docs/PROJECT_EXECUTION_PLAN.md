# Agent Wallet Project Execution Plan

Legend:
- `[x]` Done and locally verified.
- `[~]` In progress, usable but not production-final.
- `[ ]` Pending.
- `[!]` Requires product, security, or external platform decision.

## Phase 0 - Repository Safety And Initialization

- `[x]` Initialize local Git repository and set GitHub remote.
- `[x]` Keep local secrets out of Git: `.env.local`, mobile env files, local runtime data, build artifacts, and node modules are ignored.
- `[x]` Add sanitized example storage at `data/db.example.json`.
- `[~]` Prepare first local commit after final safety scan.
- `[ ]` Push to `okx-wallet-H/agent-payments-protocol` only after the first clean commit is reviewed.

Acceptance:
- `git status --short --ignored` shows secrets and runtime data ignored.
- No real Privy secret, user wallet, OTP, or local audit data is staged.

## Phase 1 - Product Direction Lock

- `[x]` Position the app as a conversation-first Agent experience, not a technical wallet dashboard.
- `[x]` Main entry: simple AI chat. Top left opens World Cup information. Top right opens user console.
- `[x]` Recharge UX: show only one polished receive-address card with a copy action.
- `[x]` Keep strategy wallets, routing, conversion, plugin details, and low-level chain mechanics inside the Agent layer.
- `[x]` Agent progress copy streams in short human-readable lines.
- `[~]` Final visual temperature and card styling remain user-led before release polish.

Acceptance:
- A non-technical user can ask for recharge, prediction, tracking, or strategy without seeing raw implementation details.

## Phase 2 - V2 Backend Core

- `[x]` Add V2 domain model for mobile-first Agent Wallet turns, cards, records, and market snapshots.
- `[x]` Add `GET /api/v2/mobile/home`.
- `[x]` Add `GET` and `POST /api/v2/phase-one`.
- `[x]` Add `POST /api/v2/phase-one/actions`.
- `[x]` Add records, tracking, and strategies read endpoints.
- `[x]` Add user-scoped local record storage under ignored runtime data.
- `[x]` Add idempotency handling for repeated action requests.
- `[x]` Add Privy Bearer-token path and reject invalid Bearer tokens.
- `[~]` Production database migration is documented but not wired as the default runtime.

Acceptance:
- `npm run smoke:v2`
- `npm run smoke:v2:auth`

## Phase 3 - OKX Onchain OS And Prediction Integration

- `[x]` Use installed OKX Onchain OS skills and Polymarket plugin for prediction market discovery.
- `[x]` Read real market information for World Cup-related prompts when the plugin is available.
- `[x]` Support dry-run simulation without submitting orders.
- `[x]` Add OKX Outcomes adapter foundation: Event -> Market -> Outcome -> assetId normalization, X Layer chain id, market status, and watch-only handling when assetId is missing.
- `[x]` Add World Cup Explore view model so real Outcomes data can feed champion, golden boot, group stage, and upcoming match cards.
- `[~]` Real execution remains gated until TEE signing, production policy, and release approvals are complete.
- `[!]` Live trading requires a final decision on supported market venues, execution account model, and compliance boundaries.

Acceptance:
- The Agent can generate prediction cards from live plugin data.
- Simulation cannot move funds or submit an order.
- `npm run smoke:outcomes`

## Phase 4 - Mobile App Functional Skeleton

- `[x]` Add isolated V2 mobile screen behind `EXPO_PUBLIC_AGENT_WALLET_V2_UI=true`.
- `[x]` Add Privy email login and authenticated API calls.
- `[x]` Add ChatGPT-like conversation shell structure.
- `[x]` Add top-left World Cup panel and top-right user console panel.
- `[x]` Add receive-address card with copy button.
- `[x]` Add prediction card actions: simulate, track, and build strategy.
- `[x]` Lock the first mobile navigation shape: bottom tabs for Agent, World Cup, and Mine.
- `[x]` Build the World Cup activity page as a standalone campaign surface with a poster hero, Agent score, task, leaderboard, and fixed bottom actions.
- `[x]` Hide the bottom tab bar on the World Cup campaign page so the activity CTA owns the bottom area, with a fixed Home button for returning to Agent.
- `[x]` Add the World Cup Explore subpage with category tabs for champion, golden boot, group stage, and upcoming matches.
- `[~]` UI visual direction is now user-led and being polished screen by screen before repository upload.

Acceptance:
- `npm run mobile:typecheck`
- Manual simulator pass once the simulator is free.

## Phase 5 - Storage, Security, And Operations

- `[x]` Document production architecture and storage migration direction.
- `[x]` Keep JSON storage local-only and ignored for runtime data.
- `[~]` Replace JSON storage with Postgres/Supabase for multi-user production.
- `[~]` Add owner isolation to every persistent record path.
- `[!]` TEE signing service contract, attestation flow, backup policy, and incident response need a dedicated security design pass.
- `[!]` Final policy for real-fund execution limits, recovery, and customer support is not locked.

Acceptance:
- Production mode cannot rely on local JSON files.
- Every user-visible record is scoped to the authenticated owner.

## Phase 6 - Real Execution Gate

- `[x]` Keep MVP execution in analysis/simulation mode by default.
- `[~]` Define execution records for transaction hash, result, cost, error, and explorer URL.
- `[ ]` Implement TEE signer adapter interface.
- `[ ]` Implement live order submission behind explicit server-side allowlist.
- `[ ]` Add replay protection, nonce handling, and per-user execution locks.
- `[ ]` Add production monitoring for failed orders, stale market data, and abnormal spend.
- `[!]` Mainnet release requires legal/compliance confirmation for prediction market access by jurisdiction.

Acceptance:
- No live transaction can be submitted unless production gates, signer, allowlist, and audit logging all pass.

## Phase 7 - Upload And Release Preparation

- `[~]` Complete first local Git commit with safe project files.
- `[~]` Freeze the mobile visual baseline before pushing to GitHub.
- `[ ]` Push `main` to GitHub.
- `[ ]` Create release branch for simulator and mobile QA.
- `[ ]` Run iOS and Android simulator smoke tests.
- `[ ]` Prepare App Store and Android release metadata.
- `[ ]` Prepare user-facing onboarding guide as a separate page.

Acceptance:
- Repository builds from a clean checkout using `.env.example`.
- Release checklist is green before store submission.
