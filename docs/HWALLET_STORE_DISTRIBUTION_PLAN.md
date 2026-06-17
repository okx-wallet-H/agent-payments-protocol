# HWallet Store Distribution Plan

This plan covers the path from internal preview builds to the first public App
distribution track. It is intentionally separate from product copy and UI polish:
the release objective is a working HWallet App on iOS and Android with safe
multi-user wallet boundaries.

Do not put Apple credentials, Google Play service-account JSON, access tokens,
API keys, private keys, database URLs, or verification codes in this file.

## Current State

- Current installable preview builds are recorded in
  `docs/HWALLET_MOBILE_RELEASE_HANDOFF.md`.
- Current backend target is `https://app.hwallet.vip`.
- Staging HWallet storage is Postgres-backed.
- Privy token auth and owner guard are required on staging.
- Real transaction broadcast, Agent real execution, Onchain OS live mode,
  prediction trading, and public trading API execution remain closed.

## Required Before External Testers

- Complete the installed-App multi-user pass in
  `docs/HWALLET_DEVICE_MULTI_USER_QA.md` for iOS and Android.
- Fill the ignored `.tmp/hwallet-device-evidence.json` file with redacted
  observations only.
- Run strict device evidence validation:

```sh
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
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

## iOS Path

1. Keep using internal/ad-hoc preview builds until the owner confirms the
   current iPhone pass.
2. Prepare App Store Connect:
   - App name.
   - Bundle id: `com.agentwallet.xlayer`.
   - Privacy policy URL.
   - Support URL.
   - App category.
   - Age rating answers.
   - Export compliance answer. Current app config sets
     `ITSAppUsesNonExemptEncryption` to `false`.
   - Screenshots for required iPhone sizes.
   - Review notes that explain HWallet is observe/simulate only and live money
     movement is disabled in this version.
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
   HWallet regression path.

## Android Path

1. Keep using the Android preview APK for internal install testing until the
   owner confirms Android device behavior.
2. Prepare Google Play Console:
   - App name.
   - Package name: `com.agentwallet.xlayer`.
   - Privacy policy URL.
   - Support contact.
   - Data safety answers.
   - Content rating questionnaire.
   - Store listing screenshots and icon.
   - Internal testing track tester list.
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
   clearing.

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
- iOS and Android physical-device evidence is filled and passes strict smoke.
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
- Store credentials, tokens, database URLs, private keys, or verification codes
  appear in code, docs, logs, PRs, or issue comments.
