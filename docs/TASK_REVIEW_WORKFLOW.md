# HWallet Task Review Workflow

This repo uses a small-task workflow so HWallet can move quickly without mixing unfinished work into `main`.

## Roles

- **Task owner**: claims one small task, opens a `codex/*` branch, implements it, runs validation, and opens a PR.
- **Controller**: keeps the release objective intact, assigns small tasks, checks branch scope, and decides whether to merge, return, split, or pause.
- **Reviewer**: checks product scope, safety, validation evidence, and code quality.
- **Maintainer**: merges only after the review gate is green and the reviewer accepts the change.

## Work Queue

Use this queue for 7x24 development cycles. The controller can keep moving when
no user input is needed, but must pause tasks that need device, account, DNS,
App Store, Google Play, Privy, Supabase, OKX, or payment credentials.

Recommended active lanes:

1. **HWallet wallet flow**: login, wallet generation/binding, receive address,
   copy feedback, balance sync, deposit recognition, audit, and logout/switch.
2. **Supabase data layer**: dual observation, postgres readback, user isolation,
   backup, restore, and rollback proof.
3. **Agent orchestration**: intent routing, wallet context, safe replies,
   memory, audit, and no-money-moved execution records.
4. **OKX Onchain Skill integration**: read-only, simulated, or data-display
   capability first; live execution stays closed.
5. **Mobile release**: EAS preview/production builds, OTA updates, iOS and
   Android evidence, TestFlight/internal testing, and store readiness.
6. **Docs / workflow**: gates, runbooks, checklists, and review automation.

Keep at most **three implementation branches** active at the same time. More
than that tends to create merge conflicts and weak review. A task that touches
wallet auth, storage schema, or release config should run alone unless the
other branches are docs-only.

Task states:

- **Ready**: scoped, has acceptance checks, no external blocker.
- **In progress**: assigned to one owner on one `codex/*` branch.
- **Review**: PR is open with validation evidence.
- **Returned for fixes**: CI, reviewer, or product check failed.
- **Blocked waiting for owner**: needs a real device, account login, domain,
  Apple/Google/Supabase/Privy/OKX action, or other external state.
- **Merged**: green gate, accepted review, rollback path clear.

## Flow

1. **Claim**
   - Open a `HWallet task` issue.
   - Choose one lane: wallet flow, Supabase data, Agent orchestration, OKX skill integration, mobile release, or docs/workflow.
   - Define acceptance checks before code changes begin.
   - Mark whether the task is fully automatable or needs owner evidence.

2. **Branch**
   - Create a branch named `codex/<short-task-name>`.
   - Keep the branch scoped to the issue.
   - Do not touch unrelated dirty files.

3. **Build**
   - Implement the smallest change that satisfies the task.
   - Keep real trading, swapping, signing, and money movement disabled unless a separate approved task opens them.
   - Never commit secrets, passwords, API keys, private keys, raw database URLs, or unredacted tokens.

4. **Self-review**
   - Run task-specific validation.
   - For normal app work, run at least:
     ```bash
     npm run smoke:task-review-workflow
     npm run typecheck
     npm run mobile:typecheck
     npm run smoke:mobile-api-auth
     npm run smoke:audit-timeline
     ```
   - Before merge, run:
     ```bash
     npm run dev
     npm run verify:merge
     git diff --check
     ```
   - `verify:merge` includes API smokes that expect the local Next server on `localhost:3000`. The GitHub review gate starts this server automatically.

5. **Submit**
   - Open a PR using the PR template.
   - Link the task issue.
   - Paste validation commands and results.
   - Mark any manual device or OTA checks that are still pending.

6. **Review**
   - If the review gate fails, the task is automatically **returned for fixes**.
   - If the reviewer finds product, safety, or quality issues, the PR is **returned for fixes**.
   - Fixes stay on the same branch and rerun the same validation.
   - If the task needs a real device, owner account, or third-party dashboard,
     record the missing evidence and keep the PR blocked instead of guessing.

7. **Merge**
   - Merge only when:
     - `HWallet Merge Gate` is green.
     - Review is approved.
     - The PR keeps the original task scope.
     - Rollback is clear.

## Decision Rules

- **Merge**: all checks pass, scope is tight, review is approved.
- **Return for fixes**: checks fail, acceptance criteria are incomplete, copy exposes internals, audit output is not redacted, or multi-user isolation is unclear.
- **Split task**: the PR grows beyond the issue or starts mixing wallet, UI, database, and Agent changes.
- **Close without merge**: the task is obsolete, duplicated, or unsafe for the current release phase.

## Current Product Guardrails

- HWallet is the wallet entry.
- Agent is the core experience.
- World Cup and prediction screens are examples, not the product boundary.
- User-facing wallet flow should show one receive address and keep strategy, bridge, signer, and execution details internal.
- Supabase, audit, and memory work must preserve multi-user isolation.
- OKX Onchain Skill and plugin integrations start with read-only, simulated, or data-display capability.
- Live execution remains closed until there is a separate allowlist, policy, signer, audit, and compliance gate.
