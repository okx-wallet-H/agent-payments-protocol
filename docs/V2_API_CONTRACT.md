# Agent Wallet v2 API Contract

This document describes the clean v2 contract used by the mobile Agent Wallet flow.

v2 is data-only. It does not define visual style, product temperature, or final card design. The UI should render the returned objects, but visual design remains a separate product layer.

## Core Rule

The mobile app should mostly depend on two surfaces:

- `GET /api/v2/mobile/home`
- `mobileTurn` returned by chat and action APIs

This keeps the App simple: one home payload, one conversation message format, and card actions.

## Auth

All v2 user-scoped APIs resolve the user through `v2/auth/request-user.ts`.

Resolution order:

1. `Authorization: Bearer <Privy access token>`
2. Explicit `userId` only in local non-production development
3. `demo-user` fallback for local smoke tests

Invalid Bearer tokens return `401`. Production must use Privy access tokens and should not rely on explicit `userId`.

Auth smoke test:

```sh
npm run smoke:v2:auth
```

## Home

`GET /api/v2/mobile/home`

Returns:

```ts
{
  home: MobileHomeView
}
```

`MobileHomeView` includes:

- shell: center AI conversation, top-left World Cup entry, top-right user console entry
- panels.topLeft: World Cup information
- panels.topRight: user console actions
- state: tracking, strategy, and record counts
- quickPrompts: suggested starter text
- recent: latest tracking, strategy, and records

Mobile client:

```ts
api.getV2Home(userId, walletAddress)
```

`walletAddress` should be the logged-in user's Privy embedded wallet address when available. If omitted, v2 uses a local demo fallback address.

## Chat

`POST /api/v2/phase-one`

Body:

```ts
{
  text: string,
  walletAddress?: `0x${string}`
}
```

Returns:

```ts
{
  turn: ConversationTurn,
  mobileTurn: MobileChatTurn
}
```

The App should render `mobileTurn.messages`.

Supported first-release examples:

- `我要充值` -> progress messages + one `receive_card`
- `世界杯预测` -> progress messages + one `prediction_card`

Mobile client:

```ts
api.sendV2Chat(text, userId, walletAddress)
```

Recharge cards use `walletAddress` when supplied. The demo fallback address is only for local smoke tests and must be replaced by the production user/Agent Vault address source before public release.

## Card Actions

`POST /api/v2/phase-one/actions`

Body:

```ts
{
  action: "simulate" | "track" | "build_strategy",
  market: MarketSnapshot,
  amountUsd?: number,
  idempotencyKey?: string
}
```

Returns:

```ts
{
  card: ConversationCard,
  record: PhaseOneRecord,
  mobileTurn: MobileChatTurn,
  result?: ExecutionResult,
  finalText: string
}
```

Action behavior:

- `simulate`: routes by provider. OKX Outcomes returns a local
  `outcomes.order.preview` dry-run; Polymarket markets keep
  `polymarket-plugin buy --dry-run`. No order is submitted.
- `track`: saves a tracking card.
- `build_strategy`: saves a strategy card.
- `idempotencyKey`: optional duplicate-click/retry guard. If the same resolved user submits the same key again, the API returns the existing record and does not write another one.

Mobile client:

```ts
api.runV2Action({ action, market, amountUsd })
```

or through the session helper:

```ts
runV2AgentWalletCardAction(api, session, { action, card })
```

The mobile session helper generates a default idempotency key when one is not provided. UI code can pass a custom key, but it does not need to for normal card button taps.

## Records

`GET /api/v2/phase-one/tracking`

Returns:

```ts
{
  items: TrackingCard[]
}
```

`GET /api/v2/phase-one/strategies`

Returns:

```ts
{
  items: StrategyCard[]
}
```

`GET /api/v2/phase-one/records`

Returns:

```ts
{
  items: PhaseOneRecord[]
}
```

Records are currently stored locally in `.agent-wallet-data/phase-one-records.jsonl` and filtered by resolved user id. This is an MVP storage layer and must move to Postgres before production traffic.

## Mobile Integration

The mobile app has three non-visual v2 layers:

- `apps/mobile/src/types.ts`: v2 TypeScript contracts
- `apps/mobile/src/api.ts`: v2 API client methods
- `apps/mobile/src/v2-session.ts`: conversation/session state helpers
- `apps/mobile/src/use-v2-agent-wallet.ts`: React hook for UI integration

The hook exposes:

```ts
{
  session,
  refreshHome,
  sendText,
  runCardAction,
  latestCard
}
```

UI components should call these methods and render `session.home`, `session.messages`, `session.busy`, and `session.error`.

## Current Safety Boundary

v2 currently supports real market reads and Polymarket dry-runs. It does not submit live orders.

Live execution must not be added until these are in place:

- production user auth with Privy token enforcement
- durable per-user storage
- execution policy checks
- execution preview
- confirmation gate
- append-only audit
- TEE signing integration
- incident replay logs

The first App release can safely demo observation, recharge address display, strategy cards, tracking cards, and dry-run simulation.
