# HWallet Device Multi-User QA

This checklist is for real iPhone or installable preview-build testing. It
focuses on the product body: HWallet wallet entry and Agent experience. World
Cup screens can be used as a sample Agent capability, but they are not the
release gate.

Do not paste secrets, API keys, database URLs, private keys, or long-lived
access tokens into this document.

## Required Setup

- Install the latest preview or development-staging build on the device.
- Confirm the build talks to the intended API:
  - Local LAN test: `http://YOUR_LAN_IP:3000`
  - Staging test: `https://app.hwallet.vip`
- Confirm the backend mode before testing:

```sh
npm run smoke:mobile-build-env
MOBILE_STAGING_READINESS=true EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-build-env
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

1. Refresh HWallet.
2. Paste or enter a known X Layer transaction hash for User A's wallet, if
   available.
3. Confirm the App shows a friendly result.
4. Confirm audit/records include the wallet check.
5. Ask Agent to continue after funds are recognized.

Pass criteria:

- The tx check requires an active HWallet.
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
- Any failed login, stuck wallet creation, or wrong-user data exposure.

Do not capture or share:

- Verification codes.
- Private keys.
- Raw access tokens.
- Database or server secrets.

## Local Verification Commands

Run before publishing a new build or OTA update:

```sh
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

The real device pass is still required because Privy native login, embedded
wallet creation, clipboard behavior, keyboard behavior, and Expo Updates must be
observed inside the installed App.
