# Prediction Market Phase Two Readiness

This note is the current owner/auditor view for phase two prediction-market work.
The product target is query, display, observe, and simulate. Live order
placement stays closed.

## Current Status

| Area | Status | Evidence |
| --- | --- | --- |
| OKX Outcomes market reads | Ready for read-only use | `v2/execution/okx-outcomes-client.ts` reads events, markets, ticker, candles, and order book data. |
| Explore surface | Ready for app display | `app/api/v2/world-cup/explore/route.ts` builds app-facing market cards from OKX data with fallback. |
| Detail surface | Ready for app display | `app/api/v2/prediction/detail/route.ts` returns normalized outcome rows, metrics, and order-book summary. |
| Read endpoint guard | Ready for preview | Prediction read routes reuse the Privy user boundary and a light per-user/IP rate limit before reading provider data. |
| Mobile display | Ready for UI review | `apps/mobile/src/V2AgentWalletScreen.tsx` shows OKX Outcomes, read-only status, order book summary, API Key placeholder, capability tags, observe, track, strategy, simulate, and disabled order placement. |
| Agent explanation | Ready for read-only analysis | Agent observe replies can carry friendly yes/no odds and the no-live-order boundary. |
| API Key binding | Placeholder only | The App has a visible binding position. Secret storage and user API-key lifecycle are not enabled in this release. |
| Live trading | Closed | Order placement, signing, swap, and broadcast remain disabled by execution gates. |
| Legacy preview cleanup | In progress | Old preview/demo scripts are archived; migration hold files remain documented in the cleanup queue. |

## User-Facing Capability

The App can show a prediction market as a read-only console:

- market title and provider label
- yes/no prices using friendly labels
- 24h volume, liquidity, market status, and order-book summary
- `观察` entry for Agent explanation
- `模拟预览` entry for dry-run planning
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

1. `GET /api/v2/world-cup/explore` and `GET /api/v2/prediction/detail` now pass
   through a lightweight read guard. Before high-volume production traffic, tune
   `PREDICTION_READ_RATE_LIMIT` and `PREDICTION_READ_RATE_WINDOW_MS` from real
   staging traffic.
2. `模拟预览` should become provider-aware for OKX Outcomes. It should return a
   local/contract-style dry-run preview instead of passing through legacy
   Polymarket command wording.
3. The detail page should eventually consume the server-provided action model
   directly, so UI buttons follow backend disabled/enabled status instead of
   relying on local text only.

## Verification

Run:

```bash
npm run smoke:prediction-phase-two-readiness
```

For merge candidates, this smoke is also part of:

```bash
npm run verify:merge
```
