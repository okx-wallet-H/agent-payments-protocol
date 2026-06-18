# OKX Outcomes Read-Only Integration Boundary

This note records the current prediction-market API boundary after PR #122
through PR #128. The integration is intentionally read-only / 只读. It can help
HWallet and Agent explain market data, but it must not be understood as a live
trading or order-submission feature.

## Current Read-Only Scope

- Data display: the OKX Outcomes adapter reads prediction events, markets,
  outcomes, tickers, order book summaries, volume, 24h volume, and liquidity.
- Agent explanation: Agent replies may explain `会 / 不会` odds, summarize
  available market context, and downgrade buy/sell-like user text into
  observation.
- Detail page: the prediction detail view may show outcome rows, best bid/ask,
  spread, order book depth, volume/liquidity labels, and an observe/simulate
  action set.
- Simulation: OKX Outcomes simulation is a local/contract-style dry-run preview
  only. It does not create, sign, submit, swap, or broadcast anything.
- Asset id handling: full outcome asset ids are internal market references.
  User-facing surfaces must use redacted labels such as `abc123...7890` instead
  of full asset ids.

Provider fields such as `acceptingOrders` describe the external market state
only. They do not grant HWallet permission to place an order.

## Forbidden Action List

The current release must keep all of these actions closed:

- live prediction order placement
- live buy or sell execution
- transaction signing
- swap or bridge execution
- transaction broadcast
- autonomous money movement
- private key, seed phrase, or reusable credential collection

If a user asks Agent to buy, sell, execute, sign, swap, or broadcast, the
product behavior must stay in observe/simulate mode and clearly state that no
real order or transaction was submitted.

## Acceptance Signals

- OKX Outcomes REST usage stays limited to market-data reads such as events,
  markets, ticker, candles, and order book endpoints.
- Agent market replies carry friendly odds and the no-live-order boundary.
- OKX simulation preview returns `outcomes.order.preview` with `dry_run_only`,
  `liveExecutionEnabled: false`, and `moneyMoved: false`.
- The detail view exposes only `observe` and `simulate` actions.
- Full asset ids, raw provider payloads, secrets, private keys, and full wallet
  addresses are not shown in user-facing prediction-market UI.
- Existing execution gates remain closed unless every required live-execution
  gate is deliberately opened in a separate release path.

## Future Live Capability Gate

Any future real prediction-market execution must be a separate security and
product milestone. Before it can ship, it needs all of the following:

- server-side venue, market, chain, and user allowlist
- production policy for spend limits, jurisdiction, and action type
- execution preview that shows market, side, amount, estimated cost, fees, and
  worst-case outcome before any action
- confirm code or equivalent strong user confirmation for the exact preview
- signer/key-management design with no private keys exposed to chat, docs, or
  logs
- audit trail for request, preview, confirmation, policy decision, execution
  result, failure, and rollback/support handling
- monitoring for failed orders, stale market data, abnormal spend, and repeated
  denied attempts

Until that milestone is explicitly approved, prediction markets are a read-only
research, detail-view, and dry-run simulation surface.
