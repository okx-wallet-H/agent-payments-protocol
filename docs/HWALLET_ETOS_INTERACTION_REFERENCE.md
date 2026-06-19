# HWallet ETOS Interaction Reference

This document translates useful interaction ideas from
`Eric-Terminal/ETOS-LLM-Studio` into HWallet-owned product tasks. ETOS is a
reference source only. Do not copy ETOS source code, assets, or GPL-licensed
implementation into HWallet.

## Decision

ETOS is not a suitable direct frontend base for HWallet.

- ETOS is a Swift / SwiftUI native iOS and watchOS app.
- HWallet is currently an Expo / React Native mobile app with iOS and Android
  release requirements.
- ETOS is GPL-3.0 licensed, so direct code reuse creates commercial and
  distribution risk.
- ETOS optimizes for a personal AI client. HWallet optimizes for wallet entry,
  multi-user identity, Agent guidance, auditability, and read-only market
  insight.

Use ETOS as an interaction reference, not as a code dependency.

## What To Borrow

### 1. Conversation-First Shape

ETOS makes the AI session feel like the product center instead of a settings
screen. HWallet should keep Agent as the first-class experience:

- A primary Agent input surface.
- Recent conversations that feel tappable and alive.
- A clear new-conversation action.
- Tool and wallet actions as contextual affordances, not instruction manuals.

Acceptance:

- The default surface feels like a living Agent product, not a product spec.
- No visible low-level provider, chain, or plugin mechanics unless the user asks.
- Empty states use one strong prompt and one obvious action.

### 2. Tool Center Mental Model

ETOS groups tools, MCP, shortcuts, and skills behind clear controls. HWallet
should adapt this into a simple capability model:

- HWallet for receive address, assets, records, and wallet status.
- Agent for analysis, explanation, simulation, and memory.
- Discover for read-only market/community opportunities.
- Announcements for platform messages and product updates.

Acceptance:

- Each surface exposes one job.
- Live execution stays closed unless a separate security gate is approved.
- Read-only, simulation, and real execution are visually distinct.

### 3. Local-First Trust Language

ETOS emphasizes local data, encryption, and user-controlled providers. HWallet
needs the same trust feeling, but with wallet wording:

- Show one user-facing receive address.
- Keep strategy addresses, execution internals, and raw provider payloads hidden.
- Explain sync, audit, and refresh states in human language.
- Never show secrets, full private identifiers, or raw execution payloads.

Acceptance:

- Wallet cards communicate safety in one glance.
- Copy feedback, refresh, and account switching are obvious.
- Any unavailable or pending state explains what is happening without panic.

### 4. Cross-Device Future, Not Current Scope

ETOS has strong Apple ecosystem ideas: Watch, Siri shortcuts, widgets, and
background pulses. For HWallet, these are future roadmap ideas only:

- Watch/Siri can become "Agent quick ask" later.
- Widgets can show wallet/Agent status later.
- Daily pulse can become market/community digest later.

Acceptance:

- No current release task depends on Watch, Siri, widgets, or native-only APIs.
- Current UI remains Expo-compatible for iOS and Android.

## What Not To Borrow

- Do not copy ETOS SwiftUI source, assets, or layout code.
- Do not introduce GPL code or derivative files.
- Do not migrate the current app to native Swift for v1.
- Do not adopt ETOS's personal companion visual direction directly.
- Do not expose advanced model/provider configuration to normal HWallet users.
- Do not turn HWallet into a generic AI studio.

## HWallet Page Mapping

### Login Door

Reference idea: immersive AI app entry.

HWallet translation:

- A branded doorway-style login screen.
- Email is the first step.
- The enter button sends the verification code.
- After email submission, hide the email form and show the numeric lock input.
- Keep keyboard-safe spacing on mobile.

Validation:

- The login surface works on mobile viewport without keyboard overlap.
- The flow is email -> code lock -> community.
- There is no extra "send code" row once the lock screen is active.

### Left-Top Community Page

Reference idea: sidebar/home hub.

HWallet translation:

- Top bar: back on the left, platform messages on the right.
- Member block: avatar, nickname, edit affordance, email, level, VIP progress.
- Carousel below the member block.
- Vertical entries: invite friends, card library, discover.
- Conversation history.
- Fixed new-conversation action near the bottom.

Validation:

- Main tab bar does not follow into this page.
- Carousel scrolls horizontally and has progress indicators.
- Entries open their own pages or clear placeholder surfaces.

### Agent Page

Reference idea: chat session as product center.

HWallet translation:

- Minimal hero or empty state.
- Input always visible and keyboard-safe.
- Action shortcuts should be icons or compact chips, not long explanation text.
- Agent responses can include wallet state, read-only market data, and simulate
  cards, but never claim real execution.

Validation:

- The user can start, continue, and switch sessions without learning internals.
- Prediction-market replies show read-only odds and no-live-order boundary.

### HWallet Page

Reference idea: trust center, not settings page.

HWallet translation:

- Receive address card is the anchor.
- Wallet state, network, assets, records, and refresh live in clear cards.
- Copy feedback must be visible.
- Account switching/logout must be reachable without crashing or hiding.

Validation:

- Two accounts show two different addresses.
- Copy feedback is visible.
- Refresh and tx hash verification remain optional; deposits can be recognized
  by refresh when chain data is available.

### Discover / Prediction

Reference idea: daily pulse and tool summaries.

HWallet translation:

- Read-only prediction market catalog.
- Detail card with yes/no odds, liquidity, volume, order book summary, and trend.
- Agent can explain, observe, or simulate only.

Validation:

- No buy/sell, sign, swap, broadcast, or autonomous money movement.
- Asset IDs and provider payloads are redacted.

## Subtask Plan

Use the controller plus bounded helper model:

1. **UI scout**: read ETOS screenshots/README and return reusable interaction
   patterns only. No code edits.
2. **Mobile UI draft**: implement one HWallet page at a time on a `codex/*`
   branch. No auth, schema, or native config changes.
3. **Review agent**: compare the page against this reference, run mobile smoke,
   and return approve/fix/block.

The controller remains responsible for branches, commits, PRs, merge gates, and
scope decisions.

## Current Priority

1. Finish the left-top community page interactions.
2. Finish the login door flow.
3. Polish the HWallet receive-address page.
4. Polish Agent chat empty state and keyboard behavior.
5. Add read-only prediction detail UI once the current UI surfaces are stable.

Keep each step small, testable, and reversible.
