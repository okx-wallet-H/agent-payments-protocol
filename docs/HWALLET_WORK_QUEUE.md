# HWallet 7x24 Work Queue

This queue keeps the first installable iOS and Android App moving without
mixing unfinished wallet, Agent, data, and release work into one branch.
The current HWallet Release Task Ledger is
`docs/HWALLET_RELEASE_TASK_LEDGER.md`; use that file to pick the next concrete
task after applying the rules below.

## Controller Loop

Each autonomous development cycle should:

1. Read the newest user instruction and current repo state.
2. Pick one small task from the highest-priority unblocked lane.
3. Mark the task **Claimed** with one owner and one planned `codex/*` branch.
4. Create or reuse exactly one `codex/*` branch for that task.
5. Implement the smallest change that moves the first App release forward.
6. Run the task-specific validation plus the relevant merge gates.
7. Open a PR with validation evidence.
8. Merge only after CI and review criteria pass.
9. Leave a short status note with completed work, validation, and next action.

The controller may continue 7x24 when work is local, deterministic, and covered
by smoke tests. It must stop for owner input when credentials, dashboards,
device evidence, paid services, App Store / Google Play actions, domain DNS, or
real transaction authority are required.

## Priority Order

1. **HWallet wallet flow stability**
   - Login and logout.
   - Per-user wallet binding.
   - One visible receive address.
   - Copy feedback.
   - Deposit recognition by refresh and optional tx hash.
   - Audit and memory isolation.

2. **Supabase production data layer**
   - JSONL to dual observation.
   - Postgres readback.
   - Multi-user isolation.
   - Backup and rollback.
   - Staging proof before production switch.

3. **Agent orchestration**
   - Intent recognition.
   - Wallet context.
   - Capability routing.
   - Friendly replies.
   - Transparent audit.
   - Live execution closed.

4. **OKX Onchain Skill and plugin integration**
   - Read-only market and portfolio data first.
   - Dry-run previews second.
   - Live signing and orders only after a separate policy, signer, compliance,
     and audit gate is approved.

5. **Mobile release**
   - EAS development / preview / production profiles.
   - iOS and Android installable builds.
   - OTA update runbook.
   - Device evidence.
   - TestFlight and Android internal testing readiness.

## Parallelism Rule

Keep at most three implementation branches active:

- One wallet / mobile branch.
- One backend / data / Agent branch.
- One docs / workflow branch.

Do not run two branches that both change wallet auth, storage schema, release
config, or mobile native config at the same time. Those tasks are serialized.

Subtask agents can run in parallel for bounded research or review, but they do
not count as implementation branches unless they create a `codex/*` branch.
Only the controller stages, commits, opens PRs, marks PRs ready, or merges.
Use `docs/HWALLET_SUBTASK_DISPATCH_MATRIX.md` before dispatching helper agents;
it defines helper types, dispatch packets, return packets, and hard blocks.

## Task Packet

Every task needs:

- Status.
- Lane.
- Goal.
- Branch.
- In scope.
- Out of scope.
- Acceptance checks.
- Validation commands.
- Review decision.
- Rollback path.
- Whether owner evidence is required.

The release ledger records the current task packets for the first iOS and
Android App handoff. When no fresh user instruction overrides it, use the
`Current Next Best Tasks` section in `docs/HWALLET_RELEASE_TASK_LEDGER.md`.

## Evidence Rules

- Commit source, docs, and tests.
- Do not commit `.tmp` evidence files.
- Do not paste secrets, access tokens, private keys, raw database URLs, Apple
  credentials, Google Play keys, verification codes, or unredacted user data.
- Device evidence must be redacted and validated by the evidence smoke before
  it can support release decisions.
- Build evidence must record iOS and Android EAS build ids and URLs without
  credentials.

## Stop Conditions

Stop and ask the owner when:

- A real iPhone or Android install must be tested.
- A Privy, Supabase, OKX, Apple, Google, DNS, or server dashboard action is
  needed.
- A real deposit, transaction, signing permission, or live execution approval is
  needed.
- The same external blocker repeats across work cycles.

Continue without owner input when the task is local code, docs, smoke tests,
mocked adapters, or non-secret release scaffolding.

## Next-Action Status

The controller can print the current release action state without opening a
dashboard or exposing secrets:

```sh
npm run smoke:owner-release-status
npm run smoke:release-next-action
```

`smoke:owner-release-status` is the preferred controller view. It returns a
JSON summary of local dual-device evidence, store-console evidence status,
owner-gated tasks, and the next safe action without printing emails, full wallet
addresses, credentials, or verification codes. `smoke:release-next-action` is
the narrower release-ledger view. If either command reports owner evidence is
required, continue only with unrelated local scaffolding or pause for the owner.
