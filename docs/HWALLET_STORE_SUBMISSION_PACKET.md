# HWallet Store Submission Packet

This packet is the public metadata baseline for the first iOS TestFlight and
Android internal testing handoff. It is intentionally limited to information
that can be committed safely. Do not put Apple credentials, Google Play service
account JSON, access tokens, API keys, private keys, database URLs, or
verification codes in this file.

## Product Body

- Product: 海豚社区
- App body: HWallet wallet entry plus Agent experience
- Public app name: 海豚社区
- Current binary display name: 海豚社区
- Internal wallet module: HWallet
- Public staging API: `https://app.hwallet.vip`
- Privacy policy URL: `https://app.hwallet.vip/privacy`
- Support URL: `https://app.hwallet.vip/support`
- Live execution status: closed

## Platform Identifiers

- iOS bundle id: `com.agentwallet.xlayer`
- Android package name: `com.agentwallet.xlayer`
- EAS project: `@hongchen888/agent-wallet-xlayer-mvp`
- Version: `0.1.0`

## Store Positioning Draft

Short description:

> 海豚社区 gives users a simple HWallet entry and an Agent that can read wallet
> state, recognize deposits, analyze opportunities, simulate actions, and keep
> audit records.

Long description:

> 海豚社区 is built for users who want a simple Agent-first Web3 experience. The
> App includes HWallet as the wallet entry and supports email login, an
> individual wallet address, deposit recognition, Agent analysis, simulation,
> and audit visibility. The first release keeps live trading and autonomous
> money movement disabled. Users can review what the Agent is doing without
> installing extra skills or developer tools.

Reviewer note:

> This first release supports read-only observation, simulation, local tracking,
> and strategy drafts only. The Agent can display a receive address, recognize
> wallet funds, analyze opportunities, create simulations, and show audit
> records. It cannot submit live orders or move money autonomously. Private keys
> and seed phrases are not collected by HWallet.

Review account plan:

- Follow `docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md`.
- Review login uses email-code login through Privy.
- Review emails and any temporary mailbox access belong only in private App
  Store Connect / Google Play reviewer fields.
- Static demo codes are not allowed for production review.
- Do not commit reviewer credentials, one-time codes, raw emails, or passwords.

## App Store Connect Baseline

- App name: 海豚社区
- Category: Finance
- Privacy policy URL: `https://app.hwallet.vip/privacy`
- Support URL: `https://app.hwallet.vip/support`
- Export compliance: current Expo config sets
  `ITSAppUsesNonExemptEncryption=false`.
- Review notes must include the read-only/local-draft boundary and state that
  live execution remains closed.
- Screenshots follow `docs/HWALLET_STORE_SCREENSHOT_PLAN.md` and still need
  final owner-approved visual pass before public release.

## Google Play Console Baseline

- App name: 海豚社区
- App category: Finance
- Privacy policy URL: `https://app.hwallet.vip/privacy`
- Support URL: `https://app.hwallet.vip/support`
- Data safety answers must include account identifiers, wallet addresses,
  transaction hashes supplied by users, Agent messages, records, and audit
  entries.
- Content rating must be completed in Play Console before production release.
- Screenshots follow `docs/HWALLET_STORE_SCREENSHOT_PLAN.md` and still need
  final owner-approved visual pass before public release.

## Data Safety Baseline

HWallet may process:

- Email-login account identifiers through Privy.
- Wallet addresses and public chain state.
- Transaction hashes supplied by users for deposit verification.
- Agent messages, simulation records, audit records, and App diagnostics.

HWallet must not collect:

- Private keys.
- Seed phrases.
- Login verification codes after login completes.
- Raw access tokens in logs, docs, release notes, or support tickets.

## Icon / Logo Baseline

- Owner-provided source logo: `头像01.png` from local handoff only. Do not commit
  the original download-path source file.
- Committed mobile icon assets:
  - `apps/mobile/assets/icon.png`
  - `apps/mobile/assets/adaptive-icon.png`
  - `apps/mobile/assets/splash.png`
- Required asset baseline: PNG, square, `1024 x 1024`.
- Public icon meaning: the owner-approved 海豚社区 brand mark.

## Submission Blockers

Do not submit to public production tracks until all are true:

- `npm run smoke:mobile-store-submission` passes.
- `npm run smoke:store-review-account-plan` passes.
- `npm run smoke:mobile-release-handoff` passes.
- Strict build and dual-device evidence gates pass.
- TestFlight and Android internal testing are installed and rechecked.
- Store screenshots are approved by the owner.
- Screenshot capture and redaction follow
  `docs/HWALLET_STORE_SCREENSHOT_PLAN.md`.
- Store console evidence is recorded in ignored local evidence and passes
  `smoke:hwallet-store-console-evidence` in strict mode.
- Store account credentials and service-account files remain outside git.
- Live execution remains closed unless a separate live-execution release gate is
  reviewed and merged.
