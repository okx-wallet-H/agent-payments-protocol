# Agent MCP Tool Contracts

HWallet uses a small contract table before any real MCP/API/plugin integration.
The goal is to keep the wallet core stable while external capabilities are
added one route at a time.

Implementation:

- Contract table: `v2/agent/mcp-tool-contracts.ts`
- Adapter boundary: `v2/agent/mcp-tool-adapter.ts`
- Safe executor: `v2/agent/mcp-capability-executor.ts`
- Smoke gate: `npm run smoke:agent-mcp-tool-contracts`
- Adapter smoke gate: `npm run smoke:agent-mcp-tool-adapter`

## Current Contract Stages

- `internal`: HWallet-owned operation. No MCP call.
- `mcp_pending`: an OKX Onchain OS Skill route is planned but not live.
- `api_pending`: an OKX Outcomes API route is planned but not live.
- `plugin_pending`: a plugin route is planned but not live.

Every current contract has:

- `externalCallEnabled=false`
- `liveExecutionEnabled=false`
- `moneyMovementEnabled=false`

This is intentional. The first integration pass can read or preview data, but
cannot submit transactions or move funds.

## Adapter Boundary

`mcp-tool-adapter.ts` turns a contract and an orchestration request into a
future MCP/API/plugin invocation. In the current MVP it returns one of these
safe statuses:

- `not_required`: HWallet handled the action internally.
- `disabled`: the contract exists, but external calls are still off.
- `blocked`: policy or wallet state blocks the route before adapter use.
- `failed`: adapter execution failed without any money movement.

The adapter boundary records `externalCallAttempted=false`,
`liveExecutionEnabled=false`, and `moneyMoved=false` in every current result.
Real MCP calls must not be attached until the corresponding contract is
explicitly reviewed and enabled in code.

## Current Routes

| Contract | Tool name | Safety |
| --- | --- | --- |
| `hwallet-core:hwallet.receive_address:none` | `hwallet.receive_address` | no external call |
| `hwallet-core:hwallet.wallet_status:none` | `hwallet.wallet_status` | no external call |
| `hwallet-core:hwallet.verify_transfer:none` | `hwallet.verify_transfer` | no external call |
| `hwallet-core:agent.hold:none` | `agent.hold` | no external call |
| `okx-onchainos-skills:prediction.market.observe:observe` | `okx.onchainos.prediction.market.observe` | read only |
| `okx-onchainos-skills:prediction.order.dry_run:dry_run` | `okx.onchainos.prediction.order.dry_run` | dry run only |
| `okx-outcomes:outcomes.market.observe:observe` | `okx.outcomes.market.observe` | read only |
| `okx-outcomes:outcomes.order.preview:dry_run` | `okx.outcomes.order.preview` | dry run only |
| `polymarket-plugin:prediction.market.observe:observe` | `polymarket.market.observe` | read only |
| `polymarket-plugin:prediction.order.dry_run:dry_run` | `polymarket.order.dry_run` | dry run only |

## What We Need From A Real MCP Service

For each MCP/API/plugin route, provide:

- the exact callable tool name;
- required input fields;
- optional input fields;
- fields that must be redacted from logs;
- normalized output fields;
- timeout and retry expectations;
- user-safe fallback copy when the tool fails.

Do not provide private keys, raw database URLs, server passwords, API keys, or
long-lived access tokens in chat. If a secret is required, put it into the
approved local/server environment and only tell Codex which environment variable
name exists.

## Validation

Run:

```bash
npm run smoke:agent-mcp-tool-contracts
npm run smoke:agent-mcp-tool-adapter
```

This verifies:

- every current capability route has a contract;
- route safety matches contract safety;
- no contract enables external calls, live execution, or money movement;
- contracts do not require private keys;
- executor results expose `contractId` and `toolName`;
- sensitive auth fields stay in `redactedInputs`.
- disabled contracts do not invoke a supplied adapter implementation.

Both smokes are included in `npm run verify:merge`.
