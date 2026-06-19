# Prediction Market Phase Two Readiness

This note is the current owner/auditor view for phase two prediction-market work.
The product target is query, display, observe, and simulate. Live order
placement stays closed.

## Current Status

| Area | Status | Evidence |
| --- | --- | --- |
| OKX Outcomes market reads | Ready for read-only use | `v2/execution/okx-outcomes-client.ts` reads events, markets, ticker, candles, and order book data. |
| Explore surface | Ready for app display | `app/api/v2/prediction/explore/route.ts` builds app-facing prediction-market cards from OKX data with fallback; `app/api/v2/world-cup/explore/route.ts` remains a compatibility wrapper. List cards expose sanitized `marketRef` and redacted outcome labels only. |
| Detail surface | Ready for app display | `app/api/v2/prediction/detail/route.ts` returns normalized outcome rows, metrics, order-book summary, and bounded candle-derived trend summary. |
| Detail action model | Ready for app display | The detail response carries observe, simulate, track, strategy, and disabled order-placeholder actions so the App follows backend enabled/disabled state. |
| Read endpoint guard | Ready for preview | Prediction read routes reuse the Privy user boundary and a light per-user/IP rate limit before reading provider data. |
| Mobile display | Ready for UI review | `apps/mobile/src/V2AgentWalletScreen.tsx` shows OKX Outcomes, read-only status, order book summary, trend summary, API Key placeholder, capability tags, observe, track, strategy, simulate, and disabled order placement. |
| Agent explanation | Ready for read-only analysis | Agent observe replies can carry friendly yes/no odds and the no-live-order boundary. |
| OKX Outcomes simulation preview | Ready for dry-run use | `v2/execution/okx-outcomes-preview.ts` returns a local/contract-style dry-run preview for OKX markets without creating, signing, submitting, or broadcasting orders. |
| Live field mapping | Guarded for read-only use | `docs/OKX_OUTCOMES_LIVE_FIELD_MAPPING.md` records that market detail uses `marketId`, ticker/candle/order-book reads use YES/NO outcome asset ids as `instId`, and settlement/final-result fields stay hidden until live schema is proven. |
| API Key binding | Placeholder only | The App has a visible binding position. Secret storage and user API-key lifecycle are not enabled in this release. |
| Live trading | Closed | Order placement, signing, swap, and broadcast remain disabled by execution gates. |
| Legacy preview cleanup | In progress | Old preview/demo scripts are archived; migration hold files remain documented in the cleanup queue. |

## User-Facing Capability

The App can show a prediction market as a read-only console:

- market title and provider label
- yes/no prices using friendly labels
- 24h volume, liquidity, market status, and order-book summary
- candle-derived `走势摘要` without exposing raw candle arrays
- `观察` entry for Agent explanation
- `模拟预览` entry for provider-aware dry-run planning
- `API Key · 绑定入口预留` as a future binding slot
- `当前能力` to separate query abilities, safe Agent actions, and closed live execution
- `下单未开放` for the closed live-execution path

## Closed Capability

Phase two must not expose or imply any of the following:

- live order placement
- buy/sell execution
- transaction signing
- swap or bridge execution
- transaction broadcast
- private key, seed phrase, API secret, or reusable credential collection

If the user asks for a real buy/sell action, Agent must keep the interaction in
observe/simulate mode and state that no real order or transaction was submitted.

## Known Follow-Up Risks

1. `GET /api/v2/prediction/explore` and `GET /api/v2/prediction/detail` now pass
   through a lightweight read guard. Before high-volume production traffic, tune
   `PREDICTION_READ_RATE_LIMIT` and `PREDICTION_READ_RATE_WINDOW_MS` from real
   staging traffic.
   `GET /api/v2/world-cup/explore` is kept only as a legacy compatibility path.
2. `模拟预览` is now provider-aware for OKX Outcomes. Keep testing that the
   local/contract-style dry-run preview never creates, signs, submits, or
   broadcasts an order.
3. The detail page now consumes the server-provided action model. Keep future
   UI changes tied to that model so disabled order placement cannot drift into a
   live execution affordance.
4. Explore cards intentionally avoid raw provider payloads and full asset ids.
   If future UI needs venue identifiers, fetch them through the guarded detail
   endpoint and keep labels redacted.

## Verification

Run:

```bash
npm run smoke:prediction-phase-two-readiness
npm run smoke:prediction-phase-two-goal-audit
npm run smoke:okx-outcomes-simulation-preview
npm run smoke:okx-outcomes-live-field-mapping
```

For merge candidates, this smoke is also part of:

```bash
npm run verify:merge
```

## Goal Audit Gate

`npm run smoke:prediction-phase-two-goal-audit` is the owner-facing acceptance
gate for this phase. It checks the phase-two goal directly:

- OKX Outcomes prediction-market data is connected as read-only API coverage.
- The App has frontend query/display surfaces for explore and detail views.
- Detail actions expose observe, simulate, track, strategy, and a disabled
  order placeholder.
- The API Key binding area is visible but remains a placeholder; no secret
  lifecycle is enabled in the App.
- The controller/subtask/review workflow is documented and protected by merge
  smokes.
- Archived prediction-market preview files stay out of the active app path.
- Live order placement, signing, swap, and broadcast stay closed.
