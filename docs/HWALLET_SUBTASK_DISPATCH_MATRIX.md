# HWallet Subtask Dispatch Matrix

This matrix lets the controller use helper agents without losing release
discipline. It is for the first HWallet iOS and Android App release, where the
controller remains responsible for scope, validation, PR state, and merge.

## Controller Rule

Only the controller may stage files, create commits, push branches, open PRs,
mark PRs ready, merge PRs, or update the release ledger. Subtask agents can
speed up reading, implementation drafts, and review, but their output is always
treated as evidence for the controller to verify.

Keep at most three active helper packets per cycle:

1. One research packet.
2. One implementation-draft packet.
3. One review packet.

Do not run two helper packets that can modify the same wallet auth, storage,
release config, or mobile native files at the same time.

## Dispatch Packet

Every helper receives a bounded packet before it starts:

- **Task id**: ledger item or issue id.
- **Lane**: wallet, Supabase, Agent, OKX, mobile release, or docs/workflow.
- **Question**: one narrow question or outcome.
- **Allowed files**: explicit files or directories.
- **Allowed commands**: read-only commands, smoke commands, or a named draft
  edit target.
- **Stop condition**: owner evidence, failing validation, unexpected dirty
  worktree, secret exposure risk, or scope growth.
- **Return format**: findings, changed-files proposal, validation result,
  risks, and review decision.

## Helper Types

| Type | May Edit Files | May Create Branch | Primary Output | Required Validation | Stop Immediately When |
| --- | --- | --- | --- | --- | --- |
| Research scout | No | No | Findings, file references, risk list | Read-only command output or doc links | A credential, dashboard action, or real device is needed |
| Implementation draft | Yes, only inside controller branch and allowed files | No | Patch proposal or completed local edits for controller review | Task-specific smoke plus `git diff --check` | It must touch auth, schema, native config, or unrelated UI outside scope |
| Review agent | No | No | Approve, return for fixes, split task, or block decision | Review gate commands or targeted smoke | Validation fails or evidence is missing |
| Release evidence clerk | No | No | Redacted status checklist and missing owner evidence | Evidence smoke in non-secret mode | Raw emails, full wallet addresses, tokens, keys, codes, or store credentials appear |

## Return Packet

Each helper returns:

- **Decision**: approve, return for fixes, split, or block waiting for owner.
- **Evidence**: commands run and their result.
- **Files observed or proposed**: exact paths.
- **Risk notes**: user-facing, wallet safety, storage isolation, release, or
  rollback risks.
- **Owner evidence needed**: yes/no, with non-secret description only.

The controller must rerun the relevant smoke or merge gate before committing
anything a helper changed.

## Hard Blocks

Subtasks must not:

- Receive or print private keys, seed phrases, Apple credentials, Google Play
  credentials, Privy access tokens, Supabase connection strings, OKX keys,
  verification codes, raw database URLs, raw emails, or unredacted wallet
  addresses.
- Enable live trading, swapping, signing, order placement, or autonomous money
  movement.
- Commit `.tmp` evidence, screenshots with personal data, or local app state.
- Merge around a failed check.

## Current Release Use

When `npm run smoke:release-next-action` reports only owner-gated tasks, helper
agents should not pretend the release is unblocked. They may continue only with
local scaffolding, docs, smoke coverage, or read-only review work that does not
require Apple, Google, device, store, DNS, payment, or credential access.
