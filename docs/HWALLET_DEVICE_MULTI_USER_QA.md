# HWallet Device Multi-User QA

This checklist is for real iPhone, Android, or installable preview-build
testing. It focuses on the product body: HWallet wallet entry and Agent
experience. World Cup screens can be used as a sample Agent capability, but
they are not the release gate.

Do not paste secrets, API keys, database URLs, private keys, or long-lived
access tokens into this document.

## Required Setup

- Install the latest preview or development-staging build on the device.
- Run the same critical HWallet flow on iOS and Android before treating a build
  as ready for external testers.
- Confirm the build talks to the intended API:
  - Local LAN test: `http://YOUR_LAN_IP:3000`
  - Staging test: `https://app.hwallet.vip`
- Confirm the backend mode before testing:

```sh
npm run smoke:mobile-build-env
MOBILE_STAGING_READINESS=true EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-build-env
```

- Before trusting device multi-user results against staging, run the Supabase readback drill so wallet,
  message, transfer, audit, record, Agent memory, and other-user isolation are
  already checked at the API/storage level.
- Before marking the installed App as an HWallet release candidate, run the
  HWallet release candidate gate. The full staging device smoke needs
  `MOBILE_DEVICE_PRIVY_ACCESS_TOKEN` and `MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN`
  so the backend can verify User A and User B under Privy protection.
- Before the manual device pass, create a local ignored evidence file:

```sh
npm run hwallet:device-evidence:init
```

- If the installed-App pass is complete, you can record the redacted evidence
  without hand-editing JSON. Use short labels, not verification codes or raw
  tokens:

```sh
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json \
HWALLET_DEVICE_EVIDENCE_CONFIRM_ALL=true \
HWALLET_DEVICE_PLATFORM=ios \
HWALLET_DEVICE_USER_A_LABEL=user-a-label \
HWALLET_DEVICE_USER_A_SHORT_ADDRESS=0x123456...abcdef \
HWALLET_DEVICE_USER_B_LABEL=user-b-label \
HWALLET_DEVICE_USER_B_SHORT_ADDRESS=0x654321...fedcba \
npm run hwallet:device-evidence:record
```

Repeat the same command for Android with
`HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json` and
`HWALLET_DEVICE_PLATFORM=android`.

- After the manual device pass, fill `.tmp/hwallet-device-evidence.json` with
  only redacted observations, set every required flow step and confirmation
  field to `true`, or generate it with `npm run hwallet:device-evidence:record`,
  and run:

```sh
HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
```

- Before external testers or store submission, validate both platforms together:

```sh
HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json \
HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json \
HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED=true \
npm run smoke:hwallet-dual-device-evidence
```

- Keep real execution closed:
  - live transaction broadcast: off
  - Agent real execution: off
  - Onchain OS live mode: off
  - prediction trading live mode: off

## Test Accounts

Use two separate login identities:

- User A: first email or social login.
- User B: second email or social login.

Record only non-sensitive observations:

- Whether login completed.
- Whether a HWallet receive address appeared.
- Whether the short address changed between users.
- Whether memory/audit/records stayed scoped to the active user.
- Whether the ordered flow was completed: App open, User A login, User A
  HWallet ready, copy feedback, switch to User B, User B login, User B HWallet
  ready, switch back to User A, signed-out boundary.

## Installed-App Regression Gate

Run this quick pass after every preview build or OTA update that touches
HWallet login, account switching, receive-address copy, keyboard behavior, or
wallet state rendering.

1. Open the installed App and log in as User A.
2. Open HWallet from the `H` entry.
3. Confirm the App does not crash or return to the launcher.
4. Confirm User A email is visible in the HWallet account area.
5. Tap `切换` and confirm the App shows a logout/switch confirmation.
6. Exit User A, log in as User B, then open HWallet again.
7. Confirm User B email is visible.
8. Confirm User B receives a different short HWallet address than User A.
9. Tap copy and confirm the button changes to `已复制`.
10. Confirm the quick action row shows `刷新到账` before the hash check action.
11. Switch back to User A and confirm User A's original HWallet address returns.

Pass criteria:

- No crash during login, switch, logout, or HWallet render.
- User A and User B have different HWallet receive addresses.
- HWallet never shows the previous user's receive address after switching.
- Copy feedback is visible before any transaction hash check.
- `刷新到账` is the normal deposit recognition action.
- The transaction hash check remains optional; normal receive flow works without
  pasting a hash.

## User A Fresh Login

1. Open the App from a fresh install or after clearing App state.
2. Log in as User A.
3. Wait until the HWallet page shows a receive address.
4. Tap copy on the receive address.
5. Confirm the copy button visibly changes to `已复制`.
6. Ask Agent for the wallet address or recharge address.
7. Confirm the Agent only exposes one receive address.
8. Open HWallet records or memory-related surfaces.
9. Confirm User A starts with either an empty state or only User A records.

Pass criteria:

- User A can log in without seeing User B data.
- HWallet address is visible and copy feedback works.
- Agent response stays simple and does not expose strategy/internal addresses.

## User A Wallet Activity

1. Tap `刷新到账` after a transfer or after copying the receive address.
2. Confirm the App can show either new funds or a friendly no-new-funds state.
3. Open `高级核对` only if you want to verify one known X Layer transaction hash.
4. Paste or enter the hash for User A's wallet, if available.
5. Confirm the App shows a friendly result.
6. Confirm audit/records include the wallet check.
7. Ask Agent to continue after funds are recognized.

Pass criteria:

- 刷新到账不需要交易哈希。
- The tx check requires an active HWallet and remains optional.
- Duplicate tx checks remain idempotent.
- Audit says no Agent money movement unless live execution is explicitly
  enabled in a later release.

## Switch To User B

1. Sign out or switch account.
2. Log in as User B.
3. Confirm the Agent conversation does not show User A messages.
4. Confirm HWallet does not show User A's receive address.
5. Wait for User B HWallet generation or backend binding.
6. Copy User B address and confirm `已复制` feedback.
7. Ask Agent for recharge address.

Pass criteria:

- User B gets a distinct scoped session.
- User B does not see User A wallet records, memory, audit, tracking, strategy,
  or chat turns.
- If User B has no funds, Agent remains in observe-only guidance.

## Switch Back To User A

1. Sign out or switch back to User A.
2. Confirm User A HWallet address is restored for User A.
3. Confirm User B address does not appear.
4. Confirm User A audit/memory/records are visible only under User A.
5. Ask Agent a short follow-up such as `继续`.

Pass criteria:

- User A returns to User A-scoped state.
- User B state is not merged into User A.
- Agent follow-up keeps live execution disabled.

## Signed-Out Boundary

1. Sign out.
2. Navigate to Agent and HWallet surfaces.
3. Confirm no previous receive address is visible.
4. Confirm wallet tx check is disabled.
5. Confirm Agent wallet actions are paused until login.

Pass criteria:

- Signed-out state cannot receive, verify tx, or continue wallet actions.
- Stale wallet address is not rendered.

## Failure Cases To Check

- Wallet creation fails: retry button appears and does not duplicate creation.
- Backend binding conflict: friendly conflict copy appears.
- Expired session/token: App asks the user to log in again.
- Clipboard contains no tx hash: App shows friendly no-hash copy.
- Network is offline: App shows a retryable error, not a blank screen.

## Evidence To Capture

Capture screenshots or notes for:

- User A HWallet ready state.
- User B HWallet ready state.
- Signed-out HWallet state.
- Copy feedback visible as `已复制`.
- Ordered flow notes for A -> B -> A -> signed out, using short labels only.
- Any failed login, stuck wallet creation, or wrong-user data exposure.

Do not capture or share:

- Verification codes.
- Private keys.
- Raw access tokens.
- Database or server secrets.

## Local Verification Commands

Run before publishing a new build or OTA update:

```sh
npm run smoke:mobile-testflight-readiness
npm run hwallet:device-evidence:init
npm run smoke:hwallet-device-evidence
npm run smoke:hwallet-dual-device-evidence
npm run smoke:hwallet-staging-handoff
npm run smoke:mobile-session
npm run smoke:privy-wallet-status
npm run smoke:mobile-api-auth
npm run mobile:typecheck
```

Run before merging release-affecting changes:

```sh
npm run verify:merge
```

## Current Automation Coverage

- `smoke:mobile-session` covers user/wallet scope keys, clean session resets,
  wallet refresh, tx verification, Agent follow-up, memory, and audit behavior.
- `smoke:privy-wallet-status` covers signed-out, creating, ready, backend-bound,
  conflict, stale-error, and stale-wallet display boundaries.
- `smoke:mobile-api-auth` covers mobile Authorization header behavior without
  printing tokens.
- `smoke:mobile-device-hwallet:live` covers the device-facing API path. With
  one Privy token it verifies User A's wallet flow; with
  `MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN` it also verifies User B gets a
  distinct HWallet receive address and cannot see User A wallet records.
- `smoke:hwallet-device-evidence` validates the redacted manual evidence file
  for no-crash login, ordered A -> B -> A account switching, distinct receive
  addresses, visible copy feedback, signed-out clearing, and closed live
  execution.

The real device pass is still required because Privy native login, embedded
wallet creation, clipboard behavior, keyboard behavior, and Expo Updates must be
observed inside the installed App.
