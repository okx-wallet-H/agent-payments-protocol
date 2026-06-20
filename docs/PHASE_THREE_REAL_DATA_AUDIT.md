# Phase Three Real Data Audit

## Current Boundary

Phase three focuses on replacing silent demo or sample data with explicit real-data states. Sample data can still exist for local development and smoke tests, but it must be requested explicitly with a sample mode and must not appear as live user data.

## Closed In This Pass

- `GET /api/v2/prediction/explore` no longer fills missing live OKX Outcomes categories with local sample markets.
- `GET /api/v2/prediction/explore?mode=live` returns an unavailable empty market view when real OKX data cannot be read, instead of showing sample markets.
- `GET /api/v2/prediction/detail` now returns explicit unavailable errors when OKX Outcomes credentials are missing or live reads fail.
- Prediction detail sample candles and order books are only returned through explicit sample mode.
- Mobile prediction source contracts now separate `live`, `sample`, and `unavailable`; the old mixed `live_or_fallback` label is removed.

## Remaining High Risk Fake Data Queue

1. HWallet fixed receive-address fallback in wallet orchestration must be removed or limited to explicit dev mode before production.
2. Public web preview still has demo identity, permissive six-digit unlock, and canned Agent replies; this must stay outside production auth.
3. Mobile empty-state transaction, audit, community, and carousel content still needs a clear demo/empty marker or real data binding.
4. MCP capability executor still has safe mock execution branches; keep them read-only and separate from audit records until real skills are wired.
5. Production data store must be forced to Postgres in staging/production, with JSONL limited to local fallback.
6. RPC failures should be reported as RPC unavailable instead of collapsing into pending or not found.

## Verification

Run these after each prediction real-data pass:

- `npm run smoke:prediction-detail-route`
- `npm run smoke:mobile-prediction-market-ui`
- `npm run smoke:v2`
- `npm run smoke:prediction-phase-two-readiness`
- `npm run smoke:prediction-detail-view`
- `npm run smoke:outcomes`
- `npm run smoke:outcomes-market-catalog`
- `npm run smoke:okx-outcomes-live-field-mapping`
- `npm run typecheck`

## Rule

Never present sample prediction markets, sample order books, or sample candles as live user data. Real-data failure must be visible as `unavailable`, and real execution remains closed until allowlist, policy, preview, confirm code, audit, and monitoring are implemented.
