# OKX Outcomes Live Field Mapping

This note records the phase-two field assumptions for the OKX Outcomes
prediction-market API. The goal is to keep the App useful for read-only
research while preventing a quiet drift into live trading.

## Identity Fields

| Concept | Internal field | Accepted provider aliases | Use |
| --- | --- | --- | --- |
| Event id | `eventId` | `eventId`, `event_id`, `id` | Fetch event markets and group market cards. |
| Market id | `marketId` | `marketId`, `market_id`, `id` | Fetch a market detail object. |
| YES outcome id | `yesAssetId` | `assetId`, `asset_id`, `instId`, `inst_id` on the YES outcome | Query ticker, candles, and order book for the YES side. |
| NO outcome id | `noAssetId` | `assetId`, `asset_id`, `instId`, `inst_id` on the NO outcome | Query ticker, candles, and order book for the NO side. |

Do not use `marketId` as the `instId` for ticker, candle, or order-book reads.
Those endpoints are outcome-level reads, so the request `instId` must come from
the outcome asset id.

## Read Endpoints In Scope

The current client may call only these read endpoints:

- `/api/v5/predictions/events/search`
- `/api/v5/predictions/events`
- `/api/v5/predictions/events/{eventId}/markets`
- `/api/v5/predictions/markets/{marketId}`
- `/api/v5/market/ticker?instId=<yesAssetId|noAssetId>`
- `/api/v5/market/candles?instId=<yesAssetId|noAssetId>`
- `/api/v5/market/pm-books?instId=<yesAssetId|noAssetId>`

Every provider request stays `GET` and signed by the server. The mobile App only
sees normalized, redacted, read-only DTOs.

## Public DTO Boundary

Public App DTOs may include:

- event id and market id
- market title and status
- YES / NO price labels
- volume and liquidity labels
- redacted outcome id labels
- order-book summary
- `readOnly: true`
- `liveExecutionClosed: true`
- safe modes: `observe`, `simulate-only`

Public DTOs must not include:

- raw provider payloads
- full outcome asset ids
- API keys, secrets, passphrases, or reusable credentials
- private keys or wallet secrets
- live buy/sell/order/sign/broadcast instructions

## Settlement And Final Result

Settlement and final-result fields are not yet consumed by the App. Until a live
sample confirms the provider schema, the UI must not display a market as
settled, final, won, lost, claimable, or redeemable from guessed fields.

When live samples are available, record the exact source field names here before
turning them into user-facing copy. Candidate aliases to inspect include
`settlement`, `settlementStatus`, `finalResult`, `final_result`, `result`,
`outcome`, `winner`, and `resolution`.

## Live-Sample Checklist

Before calling this integration production-complete, capture at least one live
sample for each path:

- event search result with event id and embedded or linked markets
- market detail with YES and NO outcome asset ids
- YES and NO ticker queries using outcome asset ids as `instId`
- YES and NO candle queries using outcome asset ids as `instId`
- YES and NO order book queries using outcome asset ids as `instId`
- a completed/settled market sample, if available, for settlement/final-result
  field mapping

The live-sample task is still read-only. It must not place an order, sign a
transaction, broadcast a transaction, or collect user API credentials in the
App.

Optional live schema evidence command:

```bash
npm run smoke:okx-outcomes-live-schema
```

By default this command skips without calling OKX. Set
`OKX_OUTCOMES_LIVE_SCHEMA_SMOKE=1` only when server-side OKX Outcomes
credentials are present and a live read-only schema sample is needed. The output
is redacted schema evidence only: field presence, counts, and shortened labels,
never raw payloads, full asset ids, API credentials, or execution instructions.

If the opt-in command is enabled without credentials, it exits with a structured
blocked result instead of printing stack traces. The owner action is to configure
these server-side environment variables outside git and chat:

- `PREDICTIONS_API_KEY`
- `PREDICTIONS_API_SECRET`
- `PREDICTIONS_API_PASSPHRASE`

After those are configured, rerun:

```bash
OKX_OUTCOMES_LIVE_SCHEMA_SMOKE=1 npm run smoke:okx-outcomes-live-schema
```

This remains a read-only schema check. It must not collect user API keys in the
App, place orders, sign payloads, broadcast transactions, or print full market
or outcome identifiers.
