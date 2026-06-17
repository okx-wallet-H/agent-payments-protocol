# HWallet Store Screenshot Plan

This plan defines the sanitized screenshots needed for the first iOS and
Android store handoff. It is intentionally product-facing and safe to commit.
Do not include real emails, full wallet addresses, access tokens, verification
codes, private keys, seed phrases, raw transaction hashes, or live-order
screenshots.

## Screenshot Story

The first release should show HWallet as a simple wallet entry with an Agent
experience. World Cup or prediction examples may appear only as sample Agent
analysis, not as the product identity.

Use this sequence for both iOS and Android:

1. **Agent Home**
   - Shows the clean chat entry.
   - Shows the bottom navigation and HWallet entry.
   - No developer terms, no raw policy text, no real user identity.
2. **HWallet Receive**
   - Shows one receive address card on X Layer.
   - Address must be redacted, for example `0x1234...abcd`.
   - Copy feedback is visible.
3. **Assets Ready**
   - Shows recognized funds or a safe placeholder balance.
   - Live execution stays closed.
   - Agent can continue analysis or simulation only.
4. **Agent Analysis**
   - Shows a friendly Agent response and one sample card.
   - The card must say or imply observe/simulate, not live trading.
5. **Audit / Records**
   - Shows transparent records or activity history.
   - Records must be redacted and user-readable.

## Required Device Frames

Capture at least:

- iPhone 6.7-inch portrait.
- iPhone 6.5-inch or 6.1-inch portrait fallback.
- Android phone portrait.

Tablet screenshots are optional for the first internal testing handoff unless a
store dashboard requires them.

## Copy Overlay Rules

The owner may adjust final copy, but screenshots must keep these facts true:

- HWallet is the wallet entry.
- Agent is the core experience.
- Email login creates a user session.
- The visible wallet address is one receive address.
- Deposit recognition can happen by refresh; tx hash is optional.
- The first release is observe/simulate only.
- Live signing, swaps, orders, and autonomous money movement are closed.

## Redaction Rules

Screenshots must not show:

- Raw email addresses.
- Full wallet addresses.
- Full transaction hashes.
- Verification codes.
- Access tokens.
- Private keys or seed phrases.
- Dashboard credentials.
- `.tmp` local evidence paths.

Use demo labels such as `用户 A`, `HWallet 用户`, `0x1234...abcd`, and
`0.75 USDT0` when a visual value is useful.

## Owner Approval Checklist

Before store-console evidence can be marked strict-ready:

- [ ] iOS screenshots are captured from an installable build that points to
  `https://app.hwallet.vip`.
- [ ] Android screenshots are captured from an installable build that points to
  `https://app.hwallet.vip`.
- [ ] All screenshots use redacted account and wallet data.
- [ ] Screenshots do not imply live trading, live signing, or autonomous money
  movement.
- [ ] Owner approves final visual order and copy.

## Validation

Run:

```sh
npm run smoke:store-screenshot-plan
npm run smoke:mobile-store-submission
```

Strict public release still requires owner-approved screenshot files and
store-console evidence outside git.
