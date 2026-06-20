# Phase Three Real Data Audit

## Current Boundary

Phase three focuses on replacing silent demo or sample data with explicit real-data states. Sample data can still exist for local development and smoke tests, but it must be requested explicitly with a sample mode and must not appear as live user data.

## Closed In This Pass

- `GET /api/v2/prediction/explore` no longer fills missing live OKX Outcomes categories with local sample markets.
- `GET /api/v2/prediction/explore?mode=live` returns an unavailable empty market view when real OKX data cannot be read, instead of showing sample markets.
- `GET /api/v2/prediction/detail` now returns explicit unavailable errors when OKX Outcomes credentials are missing or live reads fail.
- Prediction detail sample candles and order books are only returned through explicit sample mode.
- Mobile prediction source contracts now separate `live`, `sample`, and `unavailable`; the old mixed `live_or_fallback` label is removed.
- HWallet orchestration no longer falls back to a fixed receive address when the user wallet is missing.
- Missing HWallet addresses now remain in an explicit waiting state, with no receive card and no fake address written into Agent knowledge notes.

## Remaining High Risk Fake Data Queue

1. Public web preview still has demo identity, permissive six-digit unlock, and canned Agent replies; this must stay outside production auth.
2. Mobile empty-state transaction, audit, community, and carousel content still needs a clear demo/empty marker or real data binding.
3. MCP capability executor still has safe mock execution branches; keep them read-only and separate from audit records until real skills are wired.
4. Production data store must be forced to Postgres in staging/production, with JSONL limited to local fallback.
5. RPC failures should be reported as RPC unavailable instead of collapsing into pending or not found.

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
- `npm run smoke:hwallet-receive-address-boundary`
- `npm run typecheck`

## Rule

Never present sample prediction markets, sample order books, sample candles, or fixed fallback wallet addresses as live user data. Real-data failure must be visible as `unavailable` or an explicit waiting state, and real execution remains closed until allowlist, policy, preview, confirm code, audit, and monitoring are implemented.
