# Agent Wallet v2

This is the clean rewrite area for Dolphin Community Agent Wallet.

The old MVP code is treated as an experiment. v2 starts from a simpler rule:

- AI focuses on business tasks.
- TEE signing is a security boundary, not an AI persona.
- Onchain OS is the capability and execution layer.
- Policy is hard enforcement.
- Audit is append-only evidence.
- UI is a separate product surface.

## Layers

1. `domain`
   Core product types and rules. No UI, no CLI, no network.

2. `agent`
   Business Agent planning. It turns a user goal into a task plan.

3. `execution`
   Onchain OS and plugin execution adapters.

4. `security`
   TEE signing boundary and policy gates.

5. `audit`
   Transparent event records.

## Phase 1 App Shell

The first release should stay extremely simple:

- Main center: one premium AI conversation box.
- Top-left entrance: World Cup information display. Keep it short: summary plus a few active directions.
- Top-right entrance: user operation console. Keep it practical: recharge, strategies, tracking, records, settings.

No wallet dashboard as the first screen. No technical architecture explanation on the main screen.

Design direction from user:

- Simple like ChatGPT, but with premium texture.
- Minimal first screen; cards appear inside the conversation.
- Community/product temperature is designed by the user.

Phase 1 conversation output shape:

1. User says one sentence.
2. Agent streams short progress lines.
3. Agent returns one polished card when needed.
4. Agent ends with one short next-step sentence.

Examples:

- "我要充值" -> progress stream + one receive-address card.
- "世界杯预测" -> progress stream + one prediction card.
- "模拟" on a prediction card -> Polymarket dry-run + one simulation card.
- "跟踪" on a prediction card -> one tracking card.
- "生成策略" on a prediction card -> one strategy card.

`v2/execution/polymarket-output.ts` maps raw `polymarket-plugin` JSON into internal `MarketSnapshot` objects. This keeps UI and business logic independent from plugin response shape.

## Phase 1 Data API

`/api/v2/phase-one`

- `GET`: returns app shell, World Cup info panel, and user console panel.
- `POST { text }`: returns one conversation turn with progress lines and cards.

`/api/v2/phase-one/actions`

- `POST { action: "simulate", market, amountUsd }`: returns a simulation card and raw dry-run result.
- `POST { action: "track", market }`: returns a tracking card.
- `POST { action: "build_strategy", market }`: returns a strategy card.

This API returns data only. UI visual design remains separate.

## First Target Flow

1. User says a business goal, for example: "look for World Cup prediction opportunities".
2. Business Agent chooses an Onchain OS capability.
3. Execution adapter reads markets through `polymarket-plugin`.
4. Business Agent returns a simple opportunity plan.
5. Policy decides whether the plan is preview-only, dry-run, or eligible for live execution.
6. Execution adapter performs dry-run or live execution.
7. Audit records the whole path.

No module in v2 should ask the AI to manage private keys or explain signing mechanics in normal chat.

## Progress Stream

Agent actions should stream as short human-readable progress messages.

The stream should feel like an Agent actively doing work:

- "我先看一下可用资金。"
- "正在整理世界杯相关市场。"
- "我会先筛成交活跃的方向。"
- "准备生成一份策略。"

Do not expose raw chain/plugin mechanics in the main stream. Technical details belong in records or detail views.

## Prediction Card

Prediction cards are the main product card.

They should feel like an Agent work report, not a data table:

- clear market title
- short status text
- one natural Agent note
- 2-3 simple metrics
- suggested next action
- buttons such as simulate, track, build strategy

The Agent note should sound like a working assistant reporting back:

- "我看了一下，这个方向赔率很高，但胜率也低，适合先模拟。"
- "这个市场热度不错，我先把它整理成策略。"
- "价格不便宜，我会先看有没有更好的入场点。"

## Receive Flow

When the user says "我要充值", the Agent returns a receive card directly:

- Show only the default Agent wallet receive address.
- Do not show the strategy trading address in the main recharge flow.
- The address has a copy button.
- Any swap, bridge, or strategy-funding preparation after recharge is an Agent/internal execution-layer job.

No architecture explanation should appear in this flow.

Product design note from user:

- Recharge addresses must be shown as polished cards.
- This is the beginning of a reusable card system; many cards will be needed later.
- Main recharge flow should do subtraction: one default receive address is enough.
- User only gets the wallet recharge address. AI handles later conversion or routing internally.
- The user will arrange the final UI style and product temperature.
