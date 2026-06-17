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
- Staging backend readiness passes locally when `EXPO_PUBLIC_API_BASE_URL` is set to an HTTPS URL and `HWALLET_SESSION_STORE=postgres`.
- Current temporary staging API: `https://app.hwallet.vip`.
- EAS `development-staging`, `preview`, and `production` profiles point to the verified staging API.

## Before TestFlight / Internal Android Testing

- Before every merge, local commit, or push, run `npm run verify:merge`. Do not merge if any check fails.
- Before each autonomous or delegated development cycle, pick the next Ready
  task from `docs/HWALLET_RELEASE_TASK_LEDGER.md` and keep
  `npm run smoke:release-task-ledger` green.
- Start backend locally with `npm run dev`.
- Start the v2 mobile shell with `npm run mobile:ios:v2` or `npm run mobile:android:v2`.
- Replace local `.agent-wallet-data` storage with a durable store or a staging-safe managed volume.
- Deploy a public HTTPS backend before TestFlight. Vercel is acceptable after billing is fixed; a temporary VPS is also acceptable if it follows `docs/STAGING_SERVER_DEPLOYMENT.md`.
- Confirm `AGENT_REQUIRE_OWNER=true` and `AGENT_REQUIRE_PRIVY_TOKEN=true` in staging.
- Confirm v2 endpoints reject invalid Bearer tokens with `401`.
- Confirm v2 endpoints use Privy user id, not manual `userId`, in staging.
- Verify Expo build profiles and bundle identifiers.
- Run `npm run smoke:mobile-build-env` for local config, `MOBILE_DEVICE_READINESS=true npm run smoke:mobile-build-env` for LAN device testing, and `MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env` before TestFlight/internal Android builds.
- Log in to EAS from `apps/mobile` with `npm run eas:whoami`; if it returns `Not logged in`, run `npx eas-cli login`.
- After EAS login, run `npm run eas:init` from `apps/mobile` and commit the generated `expo.extra.eas.projectId` if it is not already configured.
- Keep `apps/mobile/eas.json` preview and production API URLs pointed at the verified HTTPS staging or production API.
- For installable dev-client testing, use the `development-staging` profile so the iPhone build talks to `https://app.hwallet.vip` instead of localhost.
- Verify Privy mobile redirect/deep-link settings.
- Verify X Layer receive address shown in recharge card is the correct production address source.
- Add a basic in-app error state for expired login/token.
- Add rate limiting for chat and action endpoints.
- Add request logging without private keys, access tokens, or raw secrets.
- Run a full fresh-user test: login, home load, recharge prompt, World Cup prompt, track, strategy, simulate, records.
- Run the real-device multi-user HWallet QA checklist in `docs/HWALLET_DEVICE_MULTI_USER_QA.md`: User A login, User B login, switch back to User A, signed-out boundary, copy feedback, tx verification, memory, and audit.
- Run a mobile visual pass in 390x844 and simulator sizes: Agent empty chat, World Cup campaign page, World Cup Explore categories, Mine page, bottom fixed CTA behavior, and World Cup Home return behavior.

Mobile store readiness gate (iOS + Android):

```sh
npm run smoke:mobile-store-readiness
npm run smoke:mobile-distribution-readiness
npm run smoke:store-screenshot-plan
npm run smoke:mobile-store-submission
npm run smoke:hwallet-store-console-evidence
npm run smoke:release-owner-packet
npm run smoke:hwallet-release-candidate
npm run smoke:mobile-release-preflight
npm run smoke:mobile-release-handoff
npm run hwallet:device-evidence:init
npm run hwallet:store-console-evidence:init
npm run smoke:hwallet-device-evidence
MOBILE_STAGING_READINESS=true EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-build-env
npm run smoke:mobile-session
npm run smoke:privy-wallet-status
npm run smoke:mobile-api-auth
npm run smoke:mobile-hwallet-ux
npm run mobile:typecheck
npm run mobile:build:ios
npm run mobile:build:android
npm run mobile:store-build-evidence:init
HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_MOBILE_STORE_BUILD_EVIDENCE_CONFIRM_ALL=true HWALLET_MOBILE_STORE_BUILD_IOS_ID=<ios-eas-build-id> HWALLET_MOBILE_STORE_BUILD_ANDROID_ID=<android-eas-build-id> npm run mobile:store-build-evidence:record
HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence
HWALLET_RELEASE_PREFLIGHT_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-preflight
HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff
HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence
```

Use `docs/HWALLET_OWNER_RELEASE_PACKET.md` as the current owner-facing handoff
before any TestFlight, Google Play internal testing, or final store metadata
action. It records what the owner may provide, what must stay out of chat and
git, and which strict evidence commands the controller will run afterward.
Store screenshots must follow `docs/HWALLET_STORE_SCREENSHOT_PLAN.md`: capture
the Agent home, HWallet receive, assets-ready, Agent analysis, and audit/records
story on iOS and Android, with raw emails, full wallet addresses, full
transaction hashes, verification codes, tokens, and local `.tmp` evidence paths
redacted before owner approval.

Do not submit to TestFlight or internal Android testing if the gate fails, if
preview/production profiles point to localhost or a LAN URL, if the installed
App still shows preview-only screens, if HWallet copy feedback is missing, if
User A and User B can see each other's wallet state, or if live execution
switches are open. After the iOS and Android builds finish, fill the ignored
`.tmp/hwallet-mobile-store-build-evidence.json` file with only the EAS build
ids, build URLs, platform labels, and redacted artifact labels. Prefer the
`mobile:store-build-evidence:record` command above instead of editing the JSON
by hand, and do not commit that evidence file. For safe JS/UI fixes after a
checked preview build, publish
through:

```sh
npm --prefix apps/mobile run update:preview -- --message "Short update note"
```

Only promote the same fix to production after preview is checked on device and
the rollback path in `docs/HWALLET_EAS_UPDATE_RUNBOOK.md` is understood.
The mobile workspace also runs `npm run release:preflight` automatically before
`build:*`, `update:*`, and `submit:*` scripts. Use
`HWALLET_RELEASE_PREFLIGHT_STRICT=true` for external tester, TestFlight, internal
Android, or production handoff so build evidence and both platform device
evidence are enforced together.
Use `HWALLET_RELEASE_HANDOFF_STRICT=true` after the same evidence is filled to
prove the release handoff document, build evidence, and dual-device evidence all
describe the same candidate.

HWallet release candidate gate:

```sh
npm run smoke:hwallet-release-candidate
npm run smoke:supabase-readback-drill
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-server
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-storage-summary
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-auth-surface
STAGING_API_BASE_URL=https://app.hwallet.vip npm run hwallet:staging-evidence:record
HWALLET_STAGING_STORAGE_EVIDENCE_FILE=.tmp/hwallet-staging-storage-evidence.json HWALLET_STAGING_STORAGE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-staging-evidence
MOBILE_STAGING_READINESS=true EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-build-env
MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-device-hwallet:live
MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip MOBILE_DEVICE_PRIVY_ACCESS_TOKEN=<short-lived-user-a-token> MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN=<short-lived-user-b-token> npm run smoke:mobile-device-hwallet:live
npm run hwallet:device-evidence:init
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
```

This is the App-release gate for the HWallet product body. The first device API
smoke may stop after proving unauthenticated staging traffic is rejected; the
second authenticated run must use two short-lived Privy tokens so User A and
User B receive different HWallet addresses and cannot read each other's memory,
audit, records, or tx history. Fill the generated `.tmp/hwallet-device-evidence.json`
only with redacted observations from the installed App, then set the
confirmation fields to `true`. Do not submit to TestFlight, publish an EAS
Update, or promote production if this gate fails, if the second-user path is
skipped, if redacted device evidence is missing, or if any live execution switch
is open.

HWallet staging handoff gate:

```sh
npm run smoke:hwallet-staging-handoff
npm run hwallet:device-evidence:init
HWALLET_STAGING_HANDOFF_STRICT=true HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json MOBILE_DEVICE_PRIVY_ACCESS_TOKEN=<short-lived-user-a-token> MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN=<short-lived-user-b-token> npm run smoke:hwallet-staging-handoff
```

Use the first command for a quick staging health pass. Use the strict command
before a TestFlight/internal build handoff: it requires the two-user Privy token
API path and the redacted manual device evidence file. Do not paste the tokens
into docs or commit the evidence file.

Local v2 smoke commands:

```sh
npm run verify:merge
npm run smoke:production-readiness
npm run smoke:mobile-build-env
npm run smoke:mobile-testflight-readiness
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000 MOBILE_DEVICE_READINESS=true npm run smoke:mobile-build-env
npm run smoke:v2
npm run smoke:v2:auth
npm run smoke:outcomes
npm run mobile:typecheck
```

Staging readiness gate:

```sh
npm run smoke:supabase-cutover-safety
npm run smoke:supabase-staging-sequence
npm run smoke:supabase-readback-drill
npm run smoke:supabase-rollback-plan
STAGING_READINESS=true npm run smoke:production-readiness
EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-readiness
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-server
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-storage-summary
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-auth-surface
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run hwallet:staging-evidence:record
HWALLET_STAGING_STORAGE_EVIDENCE_FILE=.tmp/hwallet-staging-storage-evidence.json HWALLET_STAGING_STORAGE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-staging-evidence
```

The staging readiness smoke must not print secrets. It checks Privy token
enforcement, owner guard, Postgres-only HWallet storage, table readiness, and
that all live trading/broadcast switches remain closed for the MVP.
The storage summary smoke is a read-only HTTPS check for the production storage
shape; it prints only non-sensitive mode, table-count, and readiness fields.
The auth surface smoke verifies every mobile-facing HWallet and Agent endpoint
rejects unauthenticated staging traffic before any wallet or Agent work can run.
The staging evidence recorder turns those public status checks into an ignored,
redacted `.tmp` snapshot so release review can verify the same facts without
copying secrets into the repository.

Supabase staging readback drill:

```sh
npm run smoke:supabase-closeout
npm run smoke:supabase-live-closeout-log
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-observation:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-consistency:live
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-performance:live
MOBILE_STAGING_READINESS=true EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:mobile-build-env
```

Run this after the live closeout passes and before trusting a staging App build
against Supabase. It confirms same-user wallet, message, transfer, audit,
record, and Agent memory readback, plus other user isolation. If any readback
or other user isolation check fails, keep `HWALLET_SESSION_STORE=dual` or
`jsonl`, do not publish an EAS Update, do not enable live execution, and
investigate the affected API/storage path before retrying.

The current HWallet Supabase live closeout is recorded in
`docs/HWALLET_SUPABASE_LIVE_CLOSEOUT.md`. Keep this log aligned with the latest
green `dual` and `postgres` validation before treating Supabase as the active
storage path for an installable App build.

The current iOS/Android store-build handoff is recorded in
`docs/HWALLET_MOBILE_RELEASE_HANDOFF.md`. Keep that handoff aligned with the
latest EAS build ids, submit status, staging gate results, and redacted device
evidence before inviting external testers.

The store distribution path for TestFlight and Android internal testing is
recorded in `docs/HWALLET_STORE_DISTRIBUTION_PLAN.md`. Keep this plan aligned
with the latest production build, submit, store metadata, privacy, and device
evidence requirements before using `npm run submit:ios` or
`npm run submit:android`.
The public store metadata, privacy/support URLs, data-safety baseline, and
review-note boundary are recorded in
`docs/HWALLET_STORE_SUBMISSION_PACKET.md`. Keep `npm run
smoke:mobile-store-submission` green before TestFlight, Android internal
testing, or public store submission.
The redacted App Store Connect / Google Play Console action evidence is
recorded in `.tmp/hwallet-store-console-evidence.json`. Keep `npm run
smoke:hwallet-store-console-evidence` green in template mode during development
and strict mode before treating TestFlight or Android internal testing as ready.

Supabase staging stability gate:

```sh
npm run smoke:supabase-cutover-safety
npm run smoke:supabase-staging-sequence
npm run smoke:supabase-readback-drill
npm run smoke:supabase-rollback-plan
npm run smoke:supabase-closeout
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-observation:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-consistency:live
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-performance:live
EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env
```

Run this gate before a TestFlight/internal build that depends on Supabase-backed
HWallet state. The sequence intentionally starts with static safety checks, then
uses `dual` mode for shadow writes and JSONL/Postgres consistency, then switches
one local staging process to `postgres` for readback and performance. If the
performance gate fails once, run the performance gate a second time after the
same server has warmed. If the same endpoint fails again, keep
`HWALLET_SESSION_STORE=dual` or `jsonl`, do not publish an EAS Update, do not
enable live execution, and investigate the affected endpoint before retrying.

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

For staging or any server with Privy enforcement enabled, run the same command
first without a token to verify the API rejects unauthenticated device traffic.
To run the full authenticated HWallet path, provide a short-lived Privy access
token through `MOBILE_DEVICE_PRIVY_ACCESS_TOKEN`; provide
`MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN` as well when validating second-user
isolation against a protected server.

This live smoke verifies the HWallet path that the phone will use: bind wallet,
show one receive address, verify a transaction hash, write wallet records,
update audit/memory, bind a second user's distinct receive address, keep other
users isolated, and continue into the Agent flow without enabling live
execution.

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
