# HWallet Mobile Release Handoff

This note records the current installable mobile handoff state for the first
HWallet App release path. It is an operator-facing checklist and must not
contain credentials, access tokens, private keys, database URLs, verification
codes, or raw build artifact signed URLs.

## Scope

- Product body: HWallet wallet entry plus Agent experience.
- Sample capability: prediction/market screens may remain as examples, but they
  are not the product body.
- Current release mode: internal preview builds for iOS and Android.
- API target: `https://app.hwallet.vip`.
- Live execution state: closed. Real trading, Onchain OS live mode, prediction
  trading, and transaction broadcast remain disabled.

## Current Preview Builds

Both builds below were created from the same mainline commit:
`253ef6830dc894137701d0ee35aef3340b09a57d`.

| Platform | EAS profile | Channel | Build version | Status | Build page |
| --- | --- | --- | --- | --- | --- |
| iOS | `preview` | `preview` | `9` | `FINISHED` | `https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/e4603d5d-2123-4502-94f9-3e9035ba3c9e` |
| Android | `preview` | `preview` | `9` | `FINISHED` | `https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/ab124aea-fbe7-47e1-aea8-b69ceddae248` |

The ignored local file `.tmp/hwallet-mobile-store-build-evidence.json` was
updated with the two build ids and passed the strict store-build evidence smoke.
Keep that file local and ignored.

## Verified Gates

The following commands passed on 2026-06-17 against the current repo and staging
API:

```sh
npm run smoke:mobile-store-readiness
MOBILE_STAGING_READINESS=true EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-build-env
npm run mobile:typecheck
npm run smoke:hwallet-release-candidate
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-server
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-storage-summary
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-auth-surface
MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-device-hwallet:live
npm run smoke:mobile-session
npm run smoke:privy-wallet-status
npm run smoke:mobile-api-auth
npm run smoke:mobile-hwallet-ux
HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence
```

## Staging State

The staging API reported:

- HWallet storage mode: `postgres`.
- Active write path: `postgres`.
- Expected HWallet tables: `13`.
- Missing HWallet tables: `0`.
- Owner guard: enabled.
- Privy access token requirement: enabled.
- Protected mobile endpoints reject missing Privy tokens.
- Live transaction broadcast: closed.
- Agent real execution: closed.
- Onchain OS live mode: closed.
- Prediction trading live mode: closed.
- Public trading API execution: closed.

The unauthenticated device-facing smoke intentionally stops after proving that
staging rejects missing Privy access tokens. The authenticated two-user path
still requires short-lived device Privy tokens or manual installed-App evidence.

## Manual Device Handoff

Before calling this release candidate ready for external testers, complete the
installed-App checks from `docs/HWALLET_DEVICE_MULTI_USER_QA.md`:

1. Install the iOS preview build on the registered iPhone.
2. Install the Android preview build on an Android device.
3. Log in as User A.
4. Open HWallet and confirm a receive address is visible.
5. Tap copy and confirm the button changes to `已复制`.
6. Switch/logout and log in as User B.
7. Confirm User B has a different receive address.
8. Switch back to User A and confirm User A's original address returns.
9. Sign out and confirm no stale receive address remains visible.
10. Confirm Agent/HWallet actions remain observe/simulate only.

Record only redacted observations in the ignored device-evidence file:

```sh
npm run hwallet:device-evidence:init
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
```

## Remaining Release Work

- Complete Android physical-device install testing.
- Refresh iOS physical-device testing with the current-main iOS preview build.
- Fill and verify redacted `.tmp/hwallet-device-evidence.json`.
- Decide the first distribution route:
  - iOS: continue with internal/ad-hoc device testing, then TestFlight when App
    Store Connect metadata and review materials are ready.
  - Android: internal testing or APK handoff first, then Play Console when
    listing and policy assets are ready.
- Keep real execution closed until policy, signing, audit, and operator controls
  are separately reviewed.
