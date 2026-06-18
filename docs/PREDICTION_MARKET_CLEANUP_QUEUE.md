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

## Archive Candidates

These are not on the main app path and can move under a manual/archive folder
after one more reference check:

- `v2/scripts/preview-live-dry-run.mjs`
- `v2/scripts/preview-live-worldcup.mjs`
- `v2/scripts/demo-flow.mjs`
- `v2/scripts/preview-card-actions.mjs`
- `v2/scripts/preview-app-shell-panels.mjs`
- `apps/mobile/assets/world-cup-poster.png`

Before moving any of them, run:

```bash
rg "preview-live-dry-run|preview-live-worldcup|world-cup-poster|demo-flow|preview-card-actions|preview-app-shell-panels" -g '!.codegraph/**'
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

After the mobile prediction-market console is accepted, move only the archive
candidates that still have no references. Keep the OKX adapter, read-only detail
view, sample fallback, and all safety smokes in the merge gate.
