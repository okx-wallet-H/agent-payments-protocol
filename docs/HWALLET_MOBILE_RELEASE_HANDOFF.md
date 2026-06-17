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

Both builds below are the current installable internal preview candidates for
build version `9`. They share the same app version, channel, API target, and
live-execution boundary; source commits are recorded per platform because the
builds may be refreshed independently.

| Platform | EAS profile | Channel | Build version | Source commit | Status | Build page |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | `preview` | `preview` | `9` | `253ef6830dc894137701d0ee35aef3340b09a57d` | `FINISHED` | `https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/e4603d5d-2123-4502-94f9-3e9035ba3c9e` |
| Android | `preview` | `preview` | `9` | `948988fa67e7b4e74991b349a86673a91d7df311` | `FINISHED` | `https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/7819a79e-b831-4b65-bbf4-e50211eb16d1` |

The ignored local file `.tmp/hwallet-mobile-store-build-evidence.json` was
updated with the two build ids and passed the strict store-build evidence smoke.
Keep that file local and ignored.

## Current Device Evidence

The ignored local device evidence files for the current preview handoff are:

- `.tmp/hwallet-device-evidence-ios.json`
- `.tmp/hwallet-device-evidence-android.json`

They record redacted owner-observed results only: no verification codes, access
tokens, private keys, database URLs, or full unredacted wallet addresses.

Before external testers, TestFlight, Android internal testing, or production
handoff, run:

```sh
HWALLET_RELEASE_PREFLIGHT_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-preflight
HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff
```

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
HWALLET_RELEASE_PREFLIGHT_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-preflight
HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff
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
HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-dual-device-evidence
```

## Remaining Release Work

- Refresh iOS and Android evidence after any new binary build, native config
  change, Privy native extension change, or mobile runtime change.
- Keep the strict release preflight and release handoff gates green with the
  latest ignored local evidence files.
- Decide the first distribution route:
  - iOS: continue with internal/ad-hoc device testing, then TestFlight when App
    Store Connect metadata and review materials are ready.
  - Android: internal testing first, then Play Console when listing and policy
    assets are ready.
- Keep real execution closed until policy, signing, audit, and operator controls
  are separately reviewed.
