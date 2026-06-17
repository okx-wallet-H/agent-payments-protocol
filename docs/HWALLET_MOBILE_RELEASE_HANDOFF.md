# HWallet Mobile Release Handoff

This note records the current installable mobile handoff state for the first
HWallet App release path. It is an operator-facing checklist and must not
contain credentials, access tokens, private keys, database URLs, verification
codes, or raw build artifact signed URLs.

## Scope

- Product body: HWallet wallet entry plus Agent experience.
- Sample capability: prediction/market screens may remain as examples, but they
  are not the product body.
- Current release mode: iOS production store build submitted to App Store
  Connect plus Android production store build ready for Google Play Console.
- API target: `https://app.hwallet.vip`.
- Live execution state: closed. Real trading, Onchain OS live mode, prediction
  trading, and transaction broadcast remain disabled.

## Current Build Handoff

The builds below are the current mobile release handoff candidates. iOS now has
the production store build submitted through EAS Submit to App Store Connect;
Android has the production `aab` build ready for Google Play Console internal
testing. They share the same app version, API target, and live-execution
boundary; source commits are recorded per platform because the builds may be
refreshed independently.

| Platform | EAS profile | Channel | Build version | Source commit | Status | Build page |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | `production` | `production` | `10` | `da24852f6e832b9fd2c38aa39e1892d73bb036d0` | `FINISHED`, submitted to App Store Connect | `https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/60425e71-5a50-4143-92df-5aefc7499aab` |
| Android | `production` | `production` | `10` | `e546726d5d6626a164990bde80ae2befa4438ba9` | `FINISHED`, ready for Play Console | `https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/6c66eb31-ea1b-40f2-b23d-bfb3ee2fa547` |

The ignored local file `.tmp/hwallet-mobile-store-build-evidence.json` was
updated with the two production build ids and passed the strict store-build
evidence smoke. Keep that file local and ignored.

The EAS Submit job `281cbee1-d288-45d4-a3d3-15ed92c9aef4` finished for the iOS
production build and is associated with App Store Connect app id `6781393663`.
This confirms upload through EAS Submit; it does not by itself confirm Apple
processing, TestFlight internal availability, or installed-App retest.

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

The ignored local store-console evidence file currently records iOS upload as
pending Apple-side completion. It must not be marked ready until TestFlight
processing, internal testing availability, metadata checks, and installed-App
retest are all complete:

```sh
HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence
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
STAGING_API_BASE_URL=https://app.hwallet.vip npm run hwallet:staging-evidence:record
HWALLET_STAGING_STORAGE_EVIDENCE_FILE=.tmp/hwallet-staging-storage-evidence.json HWALLET_STAGING_STORAGE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-staging-evidence
MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-device-hwallet:live
npm run smoke:mobile-session
npm run smoke:privy-wallet-status
npm run smoke:mobile-api-auth
npm run smoke:mobile-hwallet-ux
HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence
HWALLET_RELEASE_PREFLIGHT_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-preflight
HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff
```

The EAS GraphQL submission lookup also returned iOS submission
`281cbee1-d288-45d4-a3d3-15ed92c9aef4` as `FINISHED` for build
`60425e71-5a50-4143-92df-5aefc7499aab`; this was recorded in ignored local
operator evidence and not committed.

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

The ignored local file `.tmp/hwallet-staging-storage-evidence.json` can be
refreshed before each release handoff. It records public staging status and
pass/fail booleans only, never credentials, tokens, database URLs, private keys,
verification codes, or user data.

The unauthenticated device-facing smoke intentionally stops after proving that
staging rejects missing Privy access tokens. The authenticated two-user path
still requires short-lived device Privy tokens or manual installed-App evidence.

## Manual Device Handoff

Before calling this release candidate ready for external testers, complete the
installed-App checks from `docs/HWALLET_DEVICE_MULTI_USER_QA.md`:

1. Install the iOS production build from TestFlight after Apple processing and
   internal testing availability are confirmed.
2. Install the Android production build from Google Play internal testing after
   the `aab` is uploaded, or use direct Android device QA only as a pre-console
   fallback.
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

- In App Store Connect, wait for iOS build `10` to finish processing, enable it
  for internal TestFlight testing, install it, and rerun the same HWallet
  multi-user checks before marking iOS store-console evidence ready.
- Upload Android build `10` to Google Play Console internal testing or connect a
  Google Play service-account key for EAS Submit; then install and rerun the
  same HWallet multi-user checks before marking Android store-console evidence
  ready.
- Refresh iOS and Android evidence after any new binary build, native config
  change, Privy native extension change, or mobile runtime change.
- Keep the strict release preflight and release handoff gates green with the
  latest ignored local evidence files.
- Decide the first distribution route:
  - iOS: TestFlight internal testing after Apple processing and metadata checks.
  - Android: Google Play internal testing after console upload or service-account
    setup.
- Keep real execution closed until policy, signing, audit, and operator controls
  are separately reviewed.
