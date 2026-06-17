# HWallet Release Task Ledger

This ledger is the controller-facing queue for getting the first iOS and
Android HWallet App to an installable, reviewable release. It complements
`docs/HWALLET_WORK_QUEUE.md`: the work queue defines the rules, while this
ledger names the current release tasks and the evidence required to move them.

## Controller Selection Rule

At the start of every development cycle:

1. Read the newest user instruction.
2. Check `git status --short --branch`.
3. Pick the first **Ready** task from the highest-priority lane below.
4. Mark it **Claimed** with one owner and one planned `codex/*` branch.
5. Open one `codex/*` branch for that task.
6. Run the task validation and the matching release gate.
7. Open a PR and merge only after `HWallet Merge Gate` passes.
8. If the first task needs owner evidence, leave a short request and continue
   with the next Ready task that is fully automatable.

Do not start live trading, signing, swapping, or autonomous money movement from
this ledger. Those require a separate approved policy, signer, compliance, and
audit task.

## Status Definitions

- **Ready**: scoped and can start now.
- **Claimed**: selected by the controller for one owner and one planned branch.
- **In progress**: one branch is actively working on it.
- **Review**: PR is open with validation evidence.
- **Returned for fixes**: CI, product review, safety review, or validation
  evidence failed and the same branch must be repaired.
- **Blocked waiting for owner**: needs a real device, dashboard, credential,
  Apple/Google/Supabase/Privy/OKX action, DNS, payment, or other external
  evidence.
- **Merged**: complete, green, and merged to `main`.

## Lane 1 - HWallet Wallet Flow Stability

### R-001 Installed App two-user wallet regression

- **Status**: Merged.
- **Owner evidence**: Completed through ignored, redacted local evidence; refresh
  required after any new installable binary.
- **Goal**: prove User A and User B can log in, receive distinct HWallet
  addresses, switch accounts without leaking state, copy a receive address with
  visible feedback, and keep live execution closed.
- **In scope**: device evidence docs, HWallet UX smoke, mobile auth smoke, and
  redacted evidence recorder.
- **Out of scope**: UI redesign, real trades, new signer authority.
- **Validation**:
  ```sh
  npm run smoke:mobile-hwallet-ux
  npm run smoke:mobile-api-auth
  npm run smoke:privy-wallet-status
  HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence
  ```
- **Done evidence**: iOS and Android installed-App evidence were captured in
  ignored local evidence and passed strict `smoke:hwallet-device-evidence`,
  `smoke:hwallet-dual-device-evidence`, `smoke:mobile-release-preflight`, and
  `smoke:mobile-release-handoff`. Only redacted labels are recorded in repo;
  raw access tokens, emails, verification codes, and unredacted addresses must
  not be committed.
- **Rollback**: revert the PR or return to the previous EAS update/build.

### R-002 Deposit recognition without mandatory hash paste

- **Status**: Merged.
- **Owner evidence**: Not required for local contract; required for real-chain
  proof.
- **Goal**: make the product contract explicit that a deposit can be discovered
  by refresh/balance sync, while tx hash verification remains an optional fast
  path.
- **In scope**: wallet sync contract, HWallet copy/deposit text, balance refresh
  smoke, audit record semantics.
- **Out of scope**: background indexer, token swap, real transfer automation.
- **Validation**:
  ```sh
  npm run smoke:wallet-sync
  npm run smoke:wallet-tx
  npm run smoke:audit-timeline
  npm run smoke:mobile-hwallet-ux
  ```
- **Done evidence**: PR #91 merged after `npm run verify:merge`; smoke proves
  hash verification is optional, refresh can surface recognized assets, and
  audit stays user-scoped.
- **Rollback**: revert wallet sync contract and mobile copy changes.

## Lane 2 - Supabase Production Data Layer

### R-003 Supabase postgres cutover candidate

- **Status**: Merged.
- **Owner evidence**: Required only if staging credentials/dashboard changes are
  needed.
- **Goal**: prove dual observation, postgres readback, multi-user isolation,
  backup posture, and rollback plan before any production storage switch.
- **In scope**: Supabase closeout docs, readback drills, staging storage
  summary, rollback instructions.
- **Out of scope**: destructive migrations, production-only data edits without
  rollback.
- **Validation**:
  ```sh
  npm run smoke:supabase-cutover-safety
  npm run smoke:supabase-staging-sequence
  npm run smoke:supabase-readback-drill
  npm run smoke:supabase-rollback-plan
  npm run smoke:supabase-closeout
  ```
- **Done evidence**: `smoke:supabase-cutover-safety`,
  `smoke:supabase-staging-sequence`, `smoke:supabase-readback-drill`,
  `smoke:supabase-rollback-plan`, and live-mode `smoke:supabase-closeout`
  passed; `docs/HWALLET_SUPABASE_LIVE_CLOSEOUT.md` records the staging evidence
  without secrets.
- **Rollback**: keep `HWALLET_SESSION_STORE=dual` or `jsonl`.

### R-004 Staging API auth and storage handoff

- **Status**: Merged.
- **Owner evidence**: Required if staging env variables or server restart are
  needed.
- **Goal**: prove `https://app.hwallet.vip` rejects unauthenticated wallet and
  Agent traffic, uses Postgres-backed HWallet storage, and keeps live execution
  closed.
- **In scope**: staging server smoke, storage summary, auth surface, release
  handoff docs.
- **Out of scope**: public store submission.
- **Validation**:
  ```sh
  STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-server
  STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-storage-summary
  STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-auth-surface
  STAGING_API_BASE_URL=https://app.hwallet.vip npm run hwallet:staging-evidence:record
  HWALLET_STAGING_STORAGE_EVIDENCE_FILE=.tmp/hwallet-staging-storage-evidence.json HWALLET_STAGING_STORAGE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-staging-evidence
  npm run smoke:hwallet-staging-handoff
  ```
- **Done evidence**: staging server, storage summary, auth surface, and handoff
  smokes passed against `https://app.hwallet.vip`; the ignored staging evidence
  snapshot can be refreshed and validated from public status endpoints; no raw
  secret was printed or stored.
- **Rollback**: restore the previous deployed backend or storage mode.

## Lane 3 - Agent Orchestration

### R-005 Agent wallet context and friendly replies

- **Status**: Merged.
- **Owner evidence**: Not required.
- **Goal**: keep Agent focused on user intent, wallet context, friendly replies,
  and transparent audit while real execution remains closed.
- **In scope**: orchestrator contracts, capability routing, memory, audit.
- **Out of scope**: live order placement, token swapping, autonomous signing.
- **Validation**:
  ```sh
  npm run smoke:agent-orchestrator
  npm run smoke:agent-wallet-intents
  npm run smoke:agent-capability-executor
  npm run smoke:audit-timeline
  ```
- **Done evidence**: PR #94 merged after `npm run verify:merge`; Agent can
  explain wallet state, recognized funds, next safe actions, and the live
  execution boundary without exposing strategy addresses or moving funds.
- **Rollback**: revert the Agent branch and keep existing wallet flow.

## Lane 4 - OKX Onchain Skill And Plugin Integration

### R-006 Read-only OKX capability adapter

- **Status**: Merged.
- **Owner evidence**: Required only if MCP/provider credentials are missing.
- **Goal**: integrate OKX/Onchain capability discovery as read-only or
  simulated data first, so HWallet can route Agent requests without live
  execution.
- **In scope**: capability registry, tool contracts, adapter safety, audit
  record shape.
- **Out of scope**: signing, broadcast, swap, bridge, paid transaction.
- **Validation**:
  ```sh
  npm run smoke:agent-capability-registry
  npm run smoke:agent-mcp-tool-contracts
  npm run smoke:agent-mcp-tool-adapter
  npm run smoke:agent-policy
  ```
- **Done evidence**: PR #96 merged after `npm run verify:merge`; disabled
  OKX/Onchain and plugin adapter routes now return standardized safe preview
  payloads while external calls, live execution, and money movement remain
  disabled.
- **Rollback**: disable the capability route and leave Agent text-only.

## Lane 5 - Mobile Release

### R-007 iOS TestFlight candidate build

- **Status**: In Apple processing / TestFlight console handoff.
- **Owner evidence**: Apple Developer account, App Store Connect/TestFlight
  processing status, internal testing action, installed-App retest.
- **Current blocker class**: Apple-side build processing, TestFlight internal
  testing availability, metadata/review material completion, and owner
  installed-App retest. Do not collect Apple credentials in chat or git.
- **Goal**: produce and record an iOS build candidate that uses
  `https://app.hwallet.vip`, passes HWallet device evidence, and is ready for
  TestFlight internal review.
- **In scope**: EAS iOS production/preview build, store build evidence,
  TestFlight readiness docs.
- **Out of scope**: public App Store release.
- **Validation**:
  ```sh
  npm run smoke:mobile-store-readiness
  npm --prefix apps/mobile run build:ios
  HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence
  ```
- **Current evidence**: EAS iOS production build
  `60425e71-5a50-4143-92df-5aefc7499aab` completed as build version `10`,
  EAS Submit job `281cbee1-d288-45d4-a3d3-15ed92c9aef4` finished, and
  `.tmp/hwallet-mobile-store-build-evidence.json` passed strict validation.
- **Done evidence**: TestFlight processing complete, internal testing ready,
  installed-App retest completed, and store-console evidence passes strict
  validation with redacted values.
- **Rollback**: do not submit the build; use prior EAS build/update.

### R-008 Android internal testing candidate build

- **Status**: Blocked waiting for owner.
- **Owner evidence**: Google Play Console access, internal testing track, signed
  Android build evidence.
- **Current blocker class**: Google Play Console/internal testing action.
  Android production build `6c66eb31-ea1b-40f2-b23d-bfb3ee2fa547` completed as
  build version `10` after owner replenished Expo/EAS build capacity.
- **Goal**: produce and record an Android build candidate that uses
  `https://app.hwallet.vip` and passes the same HWallet multi-user evidence.
- **In scope**: EAS Android production/preview build, store build evidence,
  internal testing handoff docs.
- **Out of scope**: public Google Play release.
- **Validation**:
  ```sh
  npm run smoke:mobile-store-readiness
  npm --prefix apps/mobile run build:android
  HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=.tmp/hwallet-mobile-store-build-evidence.json HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence
  ```
- **Done evidence**: EAS Android production build id and URL are recorded in
  ignored evidence, and Android device evidence passes with redacted values.
- **Rollback**: do not promote the build; use prior EAS build/update.

### R-009 Store metadata final owner pass

- **Status**: Blocked waiting for owner.
- **Owner evidence**: final Chinese/English copy, screenshots, support contact,
  privacy review, and store-console answers.
- **Goal**: turn the current submission packet into owner-approved App Store
  and Google Play metadata.
- **In scope**: `docs/HWALLET_STORE_SUBMISSION_PACKET.md`, privacy/support URLs,
  data safety baseline, screenshot checklist, and ignored store-console
  evidence.
- **Out of scope**: code changes unrelated to release metadata.
- **Validation**:
  ```sh
  npm run smoke:mobile-store-submission
  npm run smoke:hwallet-store-console-evidence
  npm run smoke:mobile-distribution-readiness
  ```
- **Done evidence**: owner-approved metadata is recorded without secrets and
  screenshots are approved outside git or via sanitized assets. App Store
  Connect / Google Play Console action evidence is recorded in ignored local
  evidence and passes strict `smoke:hwallet-store-console-evidence`.
- **Rollback**: keep metadata in draft and do not submit.

## Current Next Best Tasks

No fully automatable task remains in the current first-release queue. The next
steps need owner/store-console evidence:

1. R-007 iOS TestFlight candidate build: prepare Apple/TestFlight action when
   the owner is ready.
2. R-008 Android internal testing candidate build: upload the production AAB to
   Google Play internal testing and record redacted console evidence when the
   owner is ready.
3. R-009 Store metadata final owner pass: collect final copy, screenshots,
   support contact, privacy review, store-console answers, redacted
   store-console evidence, and `docs/HWALLET_OWNER_RELEASE_PACKET.md`.

R-007, R-008, and R-009 are intentionally owner-gated. Ask the owner only when
the branch reaches the point where real Apple/Google/device/store evidence is
needed.

## Required Release Gates

Every task that moves the release forward must keep these green:

```sh
npm run smoke:release-task-ledger
npm run smoke:task-review-workflow
npm run smoke:release-owner-packet
npm run smoke:hwallet-release-candidate
npm run smoke:release-next-action
npm run smoke:mobile-store-readiness
npm run smoke:hwallet-store-console-evidence
git diff --check
```

Before merging a release-impacting task, run `npm run verify:merge` locally or
let `HWallet Merge Gate` prove the same chain in GitHub.
