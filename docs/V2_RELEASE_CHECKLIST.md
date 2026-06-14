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
- OKX Outcomes adapter smoke currently passes: `npm run smoke:outcomes`.
- EAS CLI is pinned in the mobile workspace and available through mobile npm scripts.
- EAS project is initialized as `@hongchen888/agent-wallet-xlayer-mvp`.
- Local physical-device API readiness passes when `EXPO_PUBLIC_API_BASE_URL` uses the LAN backend URL.
- HWallet mobile-device API smoke passes against the LAN backend: wallet bind, one receive address, tx verification, audit/memory writes, user isolation, and Agent follow-up.

## Before TestFlight / Internal Android Testing

- Before every merge, local commit, or push, run `npm run verify:merge`. Do not merge if any check fails.
- Start backend locally with `npm run dev`.
- Start the v2 mobile shell with `npm run mobile:ios:v2` or `npm run mobile:android:v2`.
- Replace local `.agent-wallet-data` storage with a durable store or a staging-safe managed volume.
- Confirm `AGENT_REQUIRE_OWNER=true` and `AGENT_REQUIRE_PRIVY_TOKEN=true` in staging.
- Confirm v2 endpoints reject invalid Bearer tokens with `401`.
- Confirm v2 endpoints use Privy user id, not manual `userId`, in staging.
- Verify Expo build profiles and bundle identifiers.
- Run `npm run smoke:mobile-build-env` for local config, `MOBILE_DEVICE_READINESS=true npm run smoke:mobile-build-env` for LAN device testing, and `MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env` before TestFlight/internal Android builds.
- Log in to EAS from `apps/mobile` with `npm run eas:whoami`; if it returns `Not logged in`, run `npx eas-cli login`.
- After EAS login, run `npm run eas:init` from `apps/mobile` and commit the generated `expo.extra.eas.projectId` if it is not already configured.
- Replace `https://api.example.com` in `apps/mobile/eas.json` with the real preview and production HTTPS API URLs.
- Verify Privy mobile redirect/deep-link settings.
- Verify X Layer receive address shown in recharge card is the correct production address source.
- Add a basic in-app error state for expired login/token.
- Add rate limiting for chat and action endpoints.
- Add request logging without private keys, access tokens, or raw secrets.
- Run a full fresh-user test: login, home load, recharge prompt, World Cup prompt, track, strategy, simulate, records.
- Run a mobile visual pass in 390x844 and simulator sizes: Agent empty chat, World Cup campaign page, World Cup Explore categories, Mine page, bottom fixed CTA behavior, and World Cup Home return behavior.

Local v2 smoke commands:

```sh
npm run verify:merge
npm run smoke:production-readiness
npm run smoke:mobile-build-env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000 MOBILE_DEVICE_READINESS=true npm run smoke:mobile-build-env
npm run smoke:v2
npm run smoke:v2:auth
npm run smoke:outcomes
npm run mobile:typecheck
```

Staging readiness gate:

```sh
STAGING_READINESS=true npm run smoke:production-readiness
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
```

The staging readiness smoke must not print secrets. It checks Privy token
enforcement, owner guard, Postgres-only HWallet storage, table readiness, and
that all live trading/broadcast switches remain closed for the MVP.

For physical-device builds, set `EXPO_PUBLIC_API_BASE_URL` to the reachable
backend URL, for example the LAN URL during local testing or the staging HTTPS
API URL in EAS/TestFlight builds.
The mobile build env smoke fails device mode if the API URL is still localhost,
and fails staging mode unless the URL is HTTPS, Privy mobile client config is
present, and EAS is initialized.
Once the device-safe config gate passes and a backend is reachable on the same
network, run:

```sh
MOBILE_DEVICE_API_BASE_URL=http://YOUR_LAN_IP:3000 npm run smoke:mobile-device-hwallet:live
```

This live smoke verifies the HWallet path that the phone will use: bind wallet,
show one receive address, verify a transaction hash, write wallet records,
update audit/memory, keep other users isolated, and continue into the Agent
flow without enabling live execution.

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
