# Agent Wallet v2 Release Checklist

This checklist is for the first mobile MVP built around the clean v2 flow.

## Already Working

- Privy project is configured for local Web/Mobile development.
- Backend v2 API builds successfully.
- Mobile TypeScript builds successfully.
- Home payload is available through `GET /api/v2/mobile/home`.
- Chat returns `mobileTurn.messages`.
- Recharge flow returns one receive address card.
- World Cup prediction flow reads markets through `polymarket-plugin`.
- Prediction card actions return `mobileTurn`.
- `simulate` uses Polymarket dry-run and does not submit an order.
- `track`, `build_strategy`, and `simulate` write user-scoped records.
- Records can be read through tracking, strategies, and records endpoints.
- Mobile has v2 types, API client, session helper, and hook.
- Mobile v2 has the first visual baseline: Agent chat, World Cup campaign page, Mine page, poster hero, fixed World Cup actions, hidden bottom nav inside the campaign page, and a fixed Home return button.
- World Cup Explore subpage exists with four market categories: champion, golden boot, group stage, and upcoming matches.
- Local smoke checks currently pass: `npm run smoke:v2`, `npm run smoke:v2:auth`, and `npm run mobile:typecheck`.

## Before TestFlight / Internal Android Testing

- Start backend locally with `npm run dev`.
- Start the v2 mobile shell with `npm run mobile:ios:v2` or `npm run mobile:android:v2`.
- Replace local `.agent-wallet-data` storage with a durable store or a staging-safe managed volume.
- Confirm `AGENT_REQUIRE_OWNER=true` and `AGENT_REQUIRE_PRIVY_TOKEN=true` in staging.
- Confirm v2 endpoints reject invalid Bearer tokens with `401`.
- Confirm v2 endpoints use Privy user id, not manual `userId`, in staging.
- Verify Expo build profiles and bundle identifiers.
- Verify Privy mobile redirect/deep-link settings.
- Verify X Layer receive address shown in recharge card is the correct production address source.
- Add a basic in-app error state for expired login/token.
- Add rate limiting for chat and action endpoints.
- Add request logging without private keys, access tokens, or raw secrets.
- Run a full fresh-user test: login, home load, recharge prompt, World Cup prompt, track, strategy, simulate, records.
- Run a mobile visual pass in 390x844 and simulator sizes: Agent empty chat, World Cup campaign page, World Cup Explore categories, Mine page, bottom fixed CTA behavior, and World Cup Home return behavior.

Local v2 smoke commands:

```sh
npm run smoke:v2
npm run smoke:v2:auth
npm run mobile:typecheck
```

## Before Any Live Order

- Add policy checks to v2 action execution.
- Add execution preview.
- Add confirmation gate for live execution.
- Add TEE signing integration.
- Add idempotency keys for live execution requests.
- Add durable append-only audit.
- Add incident replay bundle export.
- Add per-user spend limits.
- Add agent pause/revoke controls.
- Add dry-run/live mode separation visible to operators.
- Run a small mainnet test only after all gates pass.

## Can Wait

- Secondary UI visual polish after the current mobile baseline is committed.
- Rich card design system.
- Advanced memory and retrieval.
- Push notifications for tracked markets.
- More prediction categories.
- Strategy marketplace.
- Social/community ranking.
- Admin analytics dashboard.

## Current Recommended Scope

The first user-facing build should stay narrow:

1. User logs in.
2. User sees one AI conversation surface.
3. User can ask for recharge address.
4. User can ask for World Cup opportunities.
5. Agent returns prediction cards.
6. User can simulate, track, or generate a strategy.
7. User can see tracking, strategies, and records.

No live order should be exposed in the first UI until the live execution checklist is complete.
