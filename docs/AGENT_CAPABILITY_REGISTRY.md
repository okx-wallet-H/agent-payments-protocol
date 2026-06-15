# Agent Capability Registry

HWallet keeps wallet ownership, login, receive address, transfer verification,
memory, and audit as the product core. External MCP services, Skills, plugins,
and APIs sit behind the Agent capability registry.

The registry is implemented in `v2/agent/capability-registry.ts`.

## Current Services

- `hwallet-core`: internal wallet and session operations. No external MCP call.
- `okx-onchainos-skills`: OKX Onchain OS Skill lane. Current modes are
  `observe` and `dry_run`.
- `okx-outcomes`: OKX Outcomes API lane. Current modes are `observe` and
  `dry_run`.
- `polymarket-plugin`: prediction plugin lane. Current modes are `observe` and
  `dry_run`.

All services currently set `liveExecutionEnabled=false`.

## Routing Rules

- Wallet receive, wallet status, and transfer verification stay on
  `hwallet-core`.
- Prediction analysis routes by market provider:
  - `okx-outcomes` markets use `outcomes.market.observe`.
  - `polymarket-plugin` markets use `prediction.market.observe`.
  - Unknown prediction providers fall back to `okx-onchainos-skills`.
- Prediction simulation routes by market provider and stays `dry_run`.
- Execute-like user text is still downgraded to read-only analysis by the
  orchestrator.

## Safety Contract

The capability object returned to the App and written to audit/action storage
includes:

- `serviceId`
- `serviceKind`
- `serviceLabel`
- `route`
- `safety`
- `liveExecution.enabled=false`

This lets the App show or hide future service details without changing wallet
logic, and lets audit records explain which service lane the Agent planned to
use.

## Validation

Run:

```bash
npm run smoke:agent-capability-registry
```

This verifies:

- all registered services keep live execution disabled;
- HWallet operations do not call external MCP services;
- OKX Outcomes routes are read-only;
- Polymarket plugin routes are dry-run only;
- execute-like user text remains downgraded to read-only analysis.

The smoke is included in `npm run verify:merge`.
