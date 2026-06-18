# HWallet Store Review Account Plan

This plan defines how App Store / Google Play reviewers can test the first
release without putting secrets, verification codes, private keys, database
URLs, or reusable passwords into git, chat, PRs, logs, or public docs.

## Review Login Boundary

- Product under review: `海豚社区`, with HWallet as the wallet entry and Agent
  as the main experience.
- Review environment: `https://app.hwallet.vip`.
- Login method: email-based Privy login.
- Live execution boundary: observe and simulate only. Live signing, swaps,
  prediction orders, broadcasts, and autonomous money movement stay closed.
- Reviewer should be able to verify:
  - Email login and logout.
  - HWallet receive address creation.
  - Copy feedback after copying the receive address.
  - Account switching with a second test email.
  - Agent read-only analysis and audit/history visibility.

## Test Account Model

Use a dedicated review account that the owner controls outside the repository.

- Primary review email: stored only in App Store Connect / Google Play private
  reviewer fields or owner-controlled mailbox notes.
- Optional second review email: used only when the reviewer needs to confirm
  account switching and separate HWallet addresses.
- Verification code: never hardcoded, never committed, and never reused as a
  static password.
- Static demo codes such as `123456` are not allowed for production review.
- If a store requires a reusable credential field, use a temporary owner-managed
  reviewer mailbox or store-private instruction, then rotate it after review.

## Reviewer Instructions Draft

Use this in private reviewer notes after replacing placeholder values inside the
store console only:

```text
This build is observe/simulate only. It does not submit live orders, sign
transactions, swap tokens, or broadcast transactions.

To test:
1. Open the App and enter the provided review email.
2. Request the email verification code.
3. Enter the code from the review mailbox.
4. Open HWallet and confirm a receive address appears.
5. Tap copy and confirm copy feedback appears.
6. Use account switch/logout if you need to verify a second review email.
7. Open Agent and ask for a read-only wallet or market analysis.

Private keys and seed phrases are never requested.
```

## Data And Redaction Rules

- Do not paste raw review emails, phone numbers, passwords, access tokens, or
  one-time codes into committed docs.
- Do not paste full wallet addresses or full transaction hashes into public
  review notes, PRs, or screenshots.
- Keep store-console evidence in ignored `.tmp` files only.
- Store reviewer credentials must be entered only in App Store Connect / Google
  Play private reviewer fields.
- Review account mailboxes must be owner-controlled and rotated or disabled
  after review.

## Go / No-Go

Go when all are true:

- `npm run smoke:store-review-account-plan` passes.
- `npm run smoke:mobile-store-submission` passes.
- Store reviewer notes explain email-code login and observe/simulate-only scope.
- Owner has created or approved the dedicated review email outside git.
- Live execution remains closed.

No-go when any are true:

- A static verification code is committed or proposed as production behavior.
- Review credentials appear in docs, PRs, chat, logs, or screenshots.
- Reviewers cannot reach `https://app.hwallet.vip`.
- HWallet shows stale wallet state after logout or account switch.
- Any live money movement gate is open.
