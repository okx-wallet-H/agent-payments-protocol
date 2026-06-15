# Agent Wallet Phase One Closeout

Date: 2026-06-13

This document is the first-stage consolidation checkpoint for the Agent Wallet / HWallet mobile MVP. It records what is ready, what has been verified locally, and what must stay out of the first production-facing scope.

## Status

Phase One is ready for repository consolidation, but not yet ready for live trading or app-store release.

The product baseline is:

- A conversation-first Agent Wallet for community users.
- HWallet as the dedicated wallet entry.
- Privy as the login, embedded-wallet, and multi-user boundary.
- X Layer as the first chain target, chain id `196`, with OKB gas.
- OKX Onchain OS / plugin capability as the Agent execution and data layer.
- Prediction-market experience in observe, explain, track, and simulate mode. World Cup is only a sample category.
- No real order placement in the user-facing MVP.

## Completed In This Stage

- Web preview login supports email-based local sessions for testing different users.
- Native mobile path is wired to Privy email login and embedded Ethereum wallet creation.
- Native mobile V2 session state is scoped by the current Privy user and HWallet address, so account or wallet switches start from a clean App session and stale async responses cannot overwrite the new user's screen.
- Backend mobile home, wallet, audit, memory, and phase-one endpoints are available.
- Wallet binding is user-scoped, and a previously bound user wallet cannot be silently replaced.
- HWallet can show a receive address, current wallet state, X Layer asset snapshots, and user-facing wallet records.
- Incoming transaction hash verification is wired for X Layer deposits.
- Agent orchestration separates business intent, policy checks, wallet context, and user-facing replies.
- Live execution remains disabled; the Agent can analyze, track, simulate, and explain.
- Market pages have a mobile visual baseline: Agent entry, sample market section, prediction views, schedule/list view, and personal/asset view.
- OKX Outcomes data adapter exists for sample market display and fallback-friendly states.
- Audit and memory foundations exist for transparent records and future retrieval.

## Verified Locally

During this checkpoint, the merge gate passed with:

```sh
npm run verify:merge
```

The merge gate includes:

- `npm run typecheck`
- `npm run mobile:typecheck`
- `npm run smoke:mobile-session`
- `npm run smoke:mobile-api-auth`
- `npm run smoke:privy-wallet-status`
- `npm run smoke:production-readiness`
- `npm run smoke:v2`
- `npm run smoke:v2:auth`
- `npm run smoke:agent-orchestrator`
- `npm run smoke:agent-policy`
- `npm run smoke:audit-timeline`
- `npm run smoke:wallet-sync`
- `npm run smoke:wallet-binding`
- `npm run smoke:wallet-tx`
- `npm run smoke:outcomes`

Run `npm run verify:merge` again before staging, committing, merging, or pushing.
For staging or production-like testing, also run:

```sh
STAGING_READINESS=true npm run smoke:production-readiness
npm run smoke:supabase-closeout
```

## Product Boundaries

User-facing copy should stay simple:

- Show one clear receive-address card when the user wants to recharge.
- Show short Agent progress lines, not low-level chain or plugin mechanics.
- Keep strategy wallets, conversion paths, routing, and execution details inside the Agent layer.
- Keep real transaction details in HWallet records and audit views.

Prediction-market MVP scope:

- Show market emotion, prediction cards, schedules, positions, and simulated results.
- Use real API data when available.
- Fall back to safe local/sample states with friendly copy when API coverage is incomplete.
- Do not submit real prediction-market orders in this stage.

## Known Limits

- Web preview email login is a local development convenience, not production authentication.
- Expo Go is not enough for the full native Privy wallet path; a development build or TestFlight build is needed.
- Production multi-user data should move from local JSON storage to a durable store.
- Market data needs final mapping to the full OKX Outcomes dataset/API payloads.
- TEE signing, attestation, backup, recovery, and incident handling are architecture requirements, not completed implementation in this stage.
- Real trading needs a separate allowlist, policy, signer, audit, and compliance gate.
- UI visual direction is intentionally not final; final polish remains user-led.

## Local Reference Files

The following local files are reference materials and should not be included in the first source commit unless explicitly reviewed:

- `世界杯`
- `Onchain Agent Wallet 开发需求文档 V0.1.pdf`
- `Onchain开发文档.txt`

## First Commit Scope

Include these source areas after review:

- `app/api/v2/mobile/*`
- `app/api/v2/phase-one/*`
- `apps/mobile/src/*`
- `apps/mobile/assets/world-cup-agent-poster.png`
- `v2/agent/*`
- `v2/auth/*`
- `v2/domain/*`
- `v2/memory/*`
- `v2/storage/*`
- `v2/wallet/*`
- `v2/scripts/smoke-*.mjs`
- `docs/*.md`
- `README.md`
- `package.json`
- `package-lock.json`

Exclude local-only material unless explicitly approved:

- `.env*`
- `.agent-wallet-data/`
- `.next/`
- `.expo/`
- `node_modules/`
- local videos, screenshots, PDFs, and imported reference notes

## Next Stage

1. Run the full merge gate again.
2. Review the dirty worktree and decide which product/source files belong in the first commit.
3. Keep local reference materials untracked.
4. Create the first clean commit.
5. Push to `okx-wallet-H/agent-payments-protocol` after the commit is reviewed.
6. Start native development-build testing for real Privy wallet login.
7. Continue HWallet production work: durable storage, audit export, wallet records, and OKX Outcomes data mapping.
