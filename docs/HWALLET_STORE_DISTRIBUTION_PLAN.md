# HWallet Store Distribution Plan

This plan covers the path from current production store builds to internal
testing and the first public App distribution track. It is intentionally
separate from product copy and UI polish: the release objective is a working
HWallet App on iOS and Android with safe multi-user wallet boundaries.

Do not put Apple credentials, Google Play service-account JSON, access tokens,
API keys, private keys, database URLs, or verification codes in this file.

## Current State

- Current production store-build handoff is recorded in
  `docs/HWALLET_MOBILE_RELEASE_HANDOFF.md`.
- Current backend target is `https://app.hwallet.vip`.
- Staging HWallet storage is Postgres-backed.
- Privy token auth and owner guard are required on staging.
- Real transaction broadcast, Agent real execution, Onchain OS live mode,
  prediction trading, and public trading API execution remain closed.

## Required Before External Testers

- Complete the installed-App multi-user pass in
  `docs/HWALLET_DEVICE_MULTI_USER_QA.md` for iOS and Android.
- Fill ignored local evidence files for both platforms with redacted
  observations only:
  - `.tmp/hwallet-device-evidence-ios.json`
  - `.tmp/hwallet-device-evidence-android.json`
- Run strict single-device evidence validation for each platform:

```sh
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
```

- Run strict dual-platform evidence validation:

```sh
HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-dual-device-evidence
```

- Run the strict release preflight so store-build evidence and both physical
  device evidence files are enforced in one command:

```sh
HWALLET_RELEASE_PREFLIGHT_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-preflight
```

- Store-build evidence must describe the current public branding before any
  external testing or submission step: public app name `海豚社区`, internal wallet
  module `HWallet`, and icon source `owner-approved-haitun-logo`. Regenerate the
  ignored `.tmp/hwallet-mobile-store-build-evidence.json` after any native build
  or public branding change; do not reuse older Agent Wallet build evidence.

- Run the strict mobile release handoff gate to verify the handoff document and
  local evidence still describe the same release candidate:

```sh
HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff
```

- Run the HWallet release candidate and staging gates:

```sh
npm run smoke:hwallet-release-candidate
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-server
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-storage-summary
STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-auth-surface
MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-device-hwallet:live
```

- Keep the strict authenticated two-user device smoke pending until short-lived
  Privy device tokens are available, or satisfy the same requirement through
  redacted physical-device evidence.
- Keep the public store metadata, privacy, support, and review-note packet in
  `docs/HWALLET_STORE_SUBMISSION_PACKET.md` green:

```sh
npm run smoke:mobile-store-submission
npm run smoke:store-review-account-plan
```

- Keep reviewer login instructions aligned with
  `docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md`. Reviewer email access, temporary
  mailbox instructions, and any one-time code handling belong only in private
  store-console fields, never in git, chat, PRs, logs, or screenshots.

- Initialize the ignored store-console evidence packet before any App Store
  Connect or Google Play Console operation:

```sh
npm run hwallet:store-console-evidence:init
npm run smoke:hwallet-store-console-evidence
```

- After TestFlight and Google Play Console actions are complete, record only
  redacted console observations and require strict evidence:

```sh
HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json HWALLET_STORE_CONSOLE_EVIDENCE_CONFIRM_ALL=true HWALLET_STORE_CONSOLE_IOS_STATUS=ready HWALLET_STORE_CONSOLE_IOS_BUILD_ID=<ios-eas-build-id> HWALLET_STORE_CONSOLE_ANDROID_STATUS=ready HWALLET_STORE_CONSOLE_ANDROID_BUILD_ID=<android-eas-build-id> npm run hwallet:store-console-evidence:record
HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence
```

- Keep `.tmp/hwallet-store-console-evidence.json` local and ignored. It may
  contain redacted App Store Connect / Google Play status labels, build ids,
  and owner confirmations only. Do not paste console credentials,
  service-account JSON, verification codes, access tokens, private keys,
  database URLs, or unredacted personal data.

## iOS Path

1. Wait for the submitted iOS production build to finish Apple processing, then
   enable it for TestFlight internal testing.
2. Prepare App Store Connect:
   - App name.
   - Bundle id: `com.agentwallet.xlayer`.
   - Privacy policy URL: `https://app.hwallet.vip/privacy`.
   - Support URL: `https://app.hwallet.vip/support`.
   - App category.
   - Age rating answers.
   - Export compliance answer. Current app config sets
     `ITSAppUsesNonExemptEncryption` to `false`.
   - Screenshots for required iPhone sizes.
   - Review notes that explain HWallet is observe/simulate only and live money
     movement is disabled in this version.
   - Reviewer login instructions from
     `docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md`.
3. Build production only after device evidence passes:

```sh
cd apps/mobile
npm run build:ios -- --non-interactive
```

4. Submit to TestFlight only after the production build finishes:

```sh
cd apps/mobile
npm run submit:ios -- --latest --non-interactive
```

5. Do not invite external testers until TestFlight processing completes and the
   installed TestFlight build passes the same User A -> User B -> User A
   HWallet regression path. Record the TestFlight page and installed retest
   result in `.tmp/hwallet-store-console-evidence.json` with redacted labels
   only.

## Android Path

1. Keep using the Android preview APK for internal install testing until the
   owner confirms Android device behavior.
2. Prepare Google Play Console:
   - App name.
   - Package name: `com.agentwallet.xlayer`.
   - Privacy policy URL: `https://app.hwallet.vip/privacy`.
   - Support URL: `https://app.hwallet.vip/support`.
   - Support contact configured outside git.
   - Data safety answers.
   - Content rating questionnaire.
   - Store listing screenshots and icon.
   - Internal testing track tester list.
   - Reviewer login instructions from
     `docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md`.
   - Service account or upload credentials kept outside git.
3. Build production only after device evidence passes:

```sh
cd apps/mobile
npm run build:android -- --non-interactive
```

4. Submit to internal testing only after the production build finishes:

```sh
cd apps/mobile
npm run submit:android -- --latest --non-interactive
```

5. Do not roll to open/production tracks until internal testers confirm login,
   HWallet receive address, copy feedback, account switching, and signed-out
   clearing. Record the internal testing page and installed retest result in
   `.tmp/hwallet-store-console-evidence.json` with redacted labels only.

## OTA Boundary

Safe JS/UI fixes can go through EAS Update after preview device testing:

```sh
cd apps/mobile
npm run update:preview -- --message "Short update note"
```

Use a new binary build instead of OTA for native modules, permissions, bundle
ids, URL schemes, Privy native extension changes, or Expo SDK changes.

## Go / No-Go

Go only when all are true:

- iOS and Android build evidence is filled and passes strict smoke.
- iOS and Android physical-device evidence is filled and passes strict
  single-device and dual-device smoke.
- Strict mobile release handoff smoke passes.
- Store submission packet smoke passes.
- Store console evidence smoke passes in strict mode after TestFlight and
  Google Play Console actions are done.
- Staging server gates pass.
- App Store Connect / Play Console metadata is prepared.
- Live execution remains closed.
- No secrets are committed.

No-go when any are true:

- User A and User B can see each other's wallet state.
- Copy feedback is missing.
- Signed-out state shows a stale wallet address.
- Staging accepts protected traffic without a Privy token.
- Any live money movement switch is enabled.
- Store console evidence is missing, still example-only, or not ignored by git.
- Store credentials, tokens, database URLs, private keys, or verification codes
  appear in code, docs, logs, PRs, or issue comments.
