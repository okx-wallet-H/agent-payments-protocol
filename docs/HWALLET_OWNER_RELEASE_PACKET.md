# HWallet Owner Release Packet

This packet is the controller handoff for the remaining first-release work.
It exists so the project can keep moving 7x24 without asking the owner for
secrets, dashboard credentials, verification codes, or raw personal data.

## Current Release State

- Product body: HWallet wallet entry plus Agent experience.
- Public API: `https://app.hwallet.vip`.
- Mobile release target: first installable iOS and Android App.
- App execution boundary: live signing, live swaps, prediction orders, and
  autonomous money movement stay closed.
- Completed local gates: wallet flow, Supabase staging path, Agent
  orchestration, read-only capability adapter, dual-device HWallet evidence,
  store build evidence, and store-console evidence scaffolding.
- Remaining release tasks: R-007 iOS TestFlight candidate build, R-008 Android
  internal testing candidate build, and R-009 store metadata final owner pass.

## Current Known External Gates

- iOS production build `60425e71-5a50-4143-92df-5aefc7499aab` has been
  submitted to App Store Connect. The remaining iOS gate is Apple-side processing,
  TestFlight internal-testing availability, metadata/review
  material completion, and installed-App retest. The controller must not ask
  for Apple credentials in chat; the owner reports only redacted status labels
  or build ids.
- Android production build `6c66eb31-ea1b-40f2-b23d-bfb3ee2fa547` completed
  after the owner replenished Expo/EAS build capacity. The remaining Android
  gate is Google Play Console upload, processing, internal-testing readiness,
  and installed-App retest.
- These blockers are external-state gates, not product logic failures. Local
  smoke gates and preview/device evidence can continue to run while waiting,
  but TestFlight or Google Play evidence cannot become strict-ready until the
  owner completes the required dashboard, credential, payment, or quota action.

## What The Owner May Need To Provide

Only provide redacted observations or screenshots. Never provide passwords,
private keys, seed phrases, Apple credentials, Google Play service-account JSON,
Privy access tokens, Supabase connection strings, OKX keys, one-time
verification codes, or unredacted personal data.

### R-007 iOS TestFlight

- Apple Developer / App Store Connect access must stay with the owner.
- Current status: iOS production build `60425e71-5a50-4143-92df-5aefc7499aab`
  finished as build `10`, and EAS Submit job
  `281cbee1-d288-45d4-a3d3-15ed92c9aef4` finished for App Store Connect.
- Required owner action: confirm the iOS build is uploaded, processed, visible
  in TestFlight internal testing, installed, and retested on the real iPhone.
- Required safe evidence: iOS EAS build id or build URL, TestFlight status
  label, installed-App retest result, and redacted screenshot labels if useful.
- Evidence file: `.tmp/hwallet-store-console-evidence.json`.

### R-008 Android Internal Testing

- Google Play Console access and upload credentials must stay with the owner.
- The current Android production `aab` is ready for Google Play Console internal
  testing. Do not paste Google credentials or service-account JSON into chat.
- Required owner action: confirm the Android build is uploaded, processed,
  assigned to internal testing, installed, and retested on the real Android
  device.
- Required safe evidence: Android EAS build id or build URL, version code,
  internal testing status label, installed-App retest result, and redacted
  screenshot labels if useful.
- Evidence file: `.tmp/hwallet-store-console-evidence.json`.

### R-009 Store Metadata

- Required owner action: final App name, subtitle, short description, long
  description, screenshots, support contact, privacy/support URL review, data
  safety answers, content rating answers, App Store review notes, and a private
  review account / reviewer mailbox plan.
- Current public URLs:
  - Privacy policy: `https://app.hwallet.vip/privacy`.
  - Support: `https://app.hwallet.vip/support`.
- Review account plan: `docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md`.
- Required safe evidence: owner approval note, redacted screenshot approval,
  metadata readiness flags, data safety/content rating completion labels, and a
  confirmation that reviewer credentials were entered only in private
  store-console fields.
- Evidence file: `.tmp/hwallet-store-console-evidence.json`.

## Commands The Controller Runs

Initialize the ignored local store-console evidence file:

```sh
npm run hwallet:store-console-evidence:init
```

Check the current status without requiring owner evidence yet. This prints
whether `.tmp/hwallet-store-console-evidence.json` is missing, pending, or ready
for strict validation. The owner-status command is the controller-friendly view:
it summarizes device evidence, store-console evidence, and the next safe action
without printing emails, full wallet addresses, credentials, or verification
codes:

```sh
npm run smoke:owner-release-status
npm run smoke:hwallet-store-console-evidence
npm run smoke:release-next-action
```

Use the `recordingGuide` section from `npm run smoke:owner-release-status` when
the owner provides Apple / Google console confirmations. It lists the safe
environment variables for iOS, Android, and shared confirmations, so the
controller can update `.tmp/hwallet-store-console-evidence.json` without
guessing field names and without collecting secrets.

Record redacted console observations after the owner confirms the dashboard
actions. If `.tmp/hwallet-mobile-store-build-evidence.json` exists, the
recorder automatically imports the already recorded iOS and Android EAS build
ids, build number, and version code; the owner only needs to confirm the
App Store / Google Play console status fields. If build evidence is missing,
add `HWALLET_STORE_CONSOLE_IOS_BUILD_ID` and
`HWALLET_STORE_CONSOLE_ANDROID_BUILD_ID` to the same command instead of pasting
anything into git:

```sh
HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json HWALLET_STORE_CONSOLE_EVIDENCE_CONFIRM_ALL=true HWALLET_STORE_CONSOLE_IOS_STATUS=ready HWALLET_STORE_CONSOLE_ANDROID_STATUS=ready npm run hwallet:store-console-evidence:record
```

Require strict evidence before treating the release as ready for internal
review:

```sh
HWALLET_STORE_CONSOLE_EVIDENCE_FILE=.tmp/hwallet-store-console-evidence.json HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence
HWALLET_RELEASE_HANDOFF_STRICT=true HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json npm run smoke:mobile-release-handoff
npm run verify:merge
```

## Stop And Continue Rules

Continue without owner input when the task is local code, docs, smoke tests,
mocked adapters, or release scaffolding.

Stop and ask the owner only when a real Apple / Google dashboard action, real
device install, screenshot approval, store metadata approval, domain/DNS
change, payment, or live transaction authority is required.

## Redaction Rules

- Store evidence in ignored `.tmp` files only.
- Use short redacted labels for screenshots and dashboard pages.
- Use build ids and URLs only when they do not reveal credentials.
- Do not paste verification codes into chat, docs, PRs, issues, or logs.
- Do not paste Apple or Google credentials into chat, docs, PRs, issues, or
  logs.
- Do not paste private keys, seed phrases, API keys, database URLs, or access
  tokens anywhere in the repo.

## Current Next Owner Ask

No secret material is needed now. The next owner ask is only:

1. Confirm the Apple/TestFlight build status when ready.
2. Confirm the Google Play internal testing build status when ready.
3. Approve final store copy and screenshots before public submission.
