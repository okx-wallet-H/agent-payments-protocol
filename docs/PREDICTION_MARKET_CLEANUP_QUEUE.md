# Prediction Market Cleanup Queue

This queue keeps the second-stage prediction-market work clean without deleting
files that still protect the app. Real orders, signing, swap, bridge, and
broadcast stay closed until a separate execution milestone is approved.

## Keep

- `v2/execution/okx-outcomes-client.ts`
  - Read-only OKX Outcomes REST adapter.
  - Supports event, market, ticker, candle, order book, catalog, and summary reads.
- `v2/execution/okx-outcomes-output.ts`
  - Normalizes provider payloads into app-safe market snapshots.
- `v2/execution/okx-world-cup-sample.ts`
  - Fallback sample for `/api/v2/world-cup/explore` and smoke coverage.
- `v2/app/prediction-detail-view.ts`
  - Read-only detail view for odds, order-book summary, volume, and safe actions.
- `docs/OKX_OUTCOMES_READONLY_INTEGRATION.md`
  - Security boundary for observe/simulate-only prediction market work.
- `v2/scripts/smoke-okx-outcomes-readonly-boundary.mjs`
  - Guardrail that keeps forbidden execution language and secrets out of the docs.

## Archived on 2026-06-18

The first reference check found these files were no longer on the main app path.
They now live under `archive/manual/prediction-market-preview/` as manual
historical material:

- `archive/manual/prediction-market-preview/v2-scripts/preview-live-dry-run.mjs`
- `archive/manual/prediction-market-preview/v2-scripts/preview-live-worldcup.mjs`
- `archive/manual/prediction-market-preview/v2-scripts/demo-flow.mjs`
- `archive/manual/prediction-market-preview/v2-scripts/preview-card-actions.mjs`
- `archive/manual/prediction-market-preview/v2-scripts/preview-app-shell-panels.mjs`
- `archive/manual/prediction-market-preview/mobile-assets/world-cup-poster.png`

The archive guard is:

```bash
npm run smoke:prediction-market-archive
```

## Do Not Archive Yet

The following legacy or fallback routes still have live references. They need a
migration first:

- `lib/polymarket.ts`
- `lib/onchainos-router.ts`
- `app/api/prediction/markets/route.ts`
- `v2/execution/polymarket-cli.ts`
- `v2/execution/polymarket-output.ts`
- `v2/execution/polymarket-dry-run.ts`
- `v2/execution/onchainos-polymarket.ts`

## Next Cleanup Step

Continue with the legacy migration before removing any Polymarket fallback files.
Keep the OKX adapter, read-only detail view, sample fallback, archive guard, and
all safety smokes in the merge gate.
