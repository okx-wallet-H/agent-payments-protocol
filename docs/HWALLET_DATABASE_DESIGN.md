# HWallet 数据层设计

## 当前结论

当前 Codex 环境没有 Supabase 专用连接器。项目采用标准 Postgres 连接方式，Supabase 只需要提供 `DATABASE_URL` 即可运行迁移。

App 默认走后端可信连接读写数据库，不把业务表直接暴露给前端 anon key。`database/schema.sql` 会对业务表开启 RLS，保持 Supabase public 表默认不可由客户端直接读写；以后如果要开放 Supabase JS SDK 直连，再单独设计精确 policy。

第一版生产数据层使用 `database/schema.sql`，核心目标是替换本地 `.agent-wallet-data/*.jsonl`，让 HWallet、Agent 会话、审计、钱包交易和市场快照能够稳定支持多用户。

## 环境变量

```bash
DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres"
```

Supabase direct connection may expose an IPv6-only host in some networks. For
local development and this workspace, use the Supabase `Session pooler` URI
instead. The project helper automatically relaxes local Node certificate
verification for `*.pooler.supabase.com`, so no secret or certificate needs to
be checked into the repo.

如果后续启用旧 MVP `lib/store.ts` 的 Postgres adapter，再设置：

```bash
AGENT_STORE=postgres
```

V2 HWallet 会话/钱包数据层现在支持显式切换：

```bash
# 默认值，不连 Supabase，继续使用本地 .agent-wallet-data/user-sessions.jsonl
HWALLET_SESSION_STORE=jsonl

# 影子双写：App 仍从 JSONL 读取，同时把会话、钱包、资产、充值验证、消息和记录写入 Supabase
HWALLET_SESSION_STORE=dual

# 生产切换候选：App 从 Supabase 读取并写入 Supabase
HWALLET_SESSION_STORE=postgres
```

`dual` 和 `postgres` 都必须同时提供 `DATABASE_URL`。默认不自动切库，避免开发环境或真机测试被数据库配置影响。

Supabase 当前 session pool 容量有限，Postgres client 默认使用低连接数：
`DATABASE_POOL_MAX=2`，即使手动覆盖也最多取 `5`。这样可以避免多个 store
各自开池时把 Supabase 连接打满。后续如果 Supabase pool 提升或切换更合适的
pooler，再调整这个值。

## Supabase 落库状态

2026-06-13 已在临时 Supabase 项目 `H-wallet-agent`（project ref `qybhqwituytwuzvwsike`）验证过 `database/schema.sql`。

正式独立项目已新建为 `Agent-Wallet-Production`（project ref `actzwcgxwejiodsgwmpf`）。本地 `.env.local` 已切到这个新项目的 Supabase Session pooler，避免和旧项目牵扯。

2026-06-13 已完成正式项目落库：

- `npm run db:migrate:postgres`: 通过，`77` 条 schema 语句已应用。
- `npm run smoke:hwallet-postgres-session:live`: 通过，完成 `dual` 写入和 `postgres` 回读。
- `npm run smoke:v2-storage-health`: 通过，确认 V2 存储健康检查不会暴露连接串，并能识别 `jsonl` / `dual` / `postgres` 模式。
- `npm run smoke:hwallet-dual-api:live`: 通过，移动端 API 在 `dual` 模式下完成钱包绑定、聊天、刷新、交易核验写入，并从 Postgres 回读。
- `npm run smoke:audit-timeline:live`: 通过，审计记录在 `dual` 模式下写入 Supabase，并从 `postgres` 模式按用户回读。
- `npm run smoke:phase-one-records:live`: 通过，预测/跟踪/策略/模拟记录层支持 `dual` 写入和 `postgres` 回读。
- `npm run smoke:agent-action-store:live`: 通过，Agent 运行记录和动作记录支持 `dual` 写入和 `postgres` 回读。
- `npm run smoke:market-snapshots:live`: 通过，市场快照支持 `dual` 写入和 `postgres` 回读。
- `npm run smoke:hwallet-postgres-session`: 通过。
- `npm run smoke:db-schema`: 通过。

已验证：

- HWallet 业务表数量：`13`
- `hwallet_wallet_transfers_user_tx_hash_idx`: 已存在
- `hwallet_agent_actions_user_idempotency_idx`: 已存在
- `hwallet_agent_records_user_idempotency_idx`: 已存在
- `hwallet_tee_signers_export_allowed_check`: 已存在

本次已完成真实数据库 schema 落库，并新增 V2 HWallet session Postgres adapter：

- 默认模式：继续使用 JSONL，现有 App 流程不变。
- `dual` 模式：JSONL 保底读取，Supabase 影子写入。
- `postgres` 模式：Supabase 读写，用于后续 staging 验证。

真实 `DATABASE_URL` 已完成多轮 `dual` 写入和 `postgres` 回读对比，确认多用户会话、钱包绑定、充值验证记录、Agent 消息、钱包记录、知识笔记和审计记录能稳定落库。

Phase-one 记录层也已接入同一套切换开关：默认继续写本地 JSONL，`dual`
模式额外镜像到 `hwallet_agent_records`，`postgres` 模式直接从 Supabase
读写预测卡、跟踪卡、策略卡和模拟卡。

Agent 运行记录和动作记录也已接入同一套切换开关：默认写入本地 JSONL，
`dual` 模式额外镜像到 `hwallet_agent_runs` 和 `hwallet_agent_actions`，
`postgres` 模式直接从 Supabase 读写。主对话入口和 phase-one action
入口都会记录 Agent 的意图、动作、风控结果、能力边界和 `money_moved=false`。

市场快照也已接入同一套切换开关：默认写入本地 JSONL，`dual` 模式额外
镜像到 `hwallet_market_snapshots`，`postgres` 模式直接从 Supabase 回读。
世界杯 explore 路由会捕获 OKX / 插件 / 样本市场快照；捕获失败只记录警告，
不影响页面正常返回。

## 核心表

- `app_users`: 用户主表，Privy 用户、邮箱和状态的归属入口。
- `hwallet_wallets`: 用户 HWallet 绑定，一个用户在 X Layer 默认绑定一个钱包。
- `hwallet_wallet_assets`: 钱包资产快照，保存 USDT0、USDT、OKB 的同步状态。
- `hwallet_wallet_transfers`: 已验证充值交易，使用 `user_id + tx_hash` 幂等。
- `hwallet_agent_sessions`: Agent 会话，保存最近一次编排状态。
- `hwallet_agent_messages`: 用户和 Agent 消息，支持文本、进度和卡片。
- `hwallet_agent_memory_items`: 用户偏好、钱包知识、策略提示、会话摘要。
- `hwallet_agent_records`: 预测卡、跟踪卡、策略卡、模拟卡的持久记录。
- `hwallet_agent_runs`: Agent 单次任务运行记录。
- `hwallet_agent_actions`: Agent 动作记录，保存 capability 和 policy 结果。
- `hwallet_audit_events`: 透明审计记录，默认 `money_moved=false`。
- `hwallet_market_snapshots`: OKX / plugin / sample 市场快照。
- `hwallet_tee_signers`: 未来 TEE 签名引用，只存 `signer_ref`，不存私钥。

## 安全约束

- 所有 HWallet / Agent / Audit 表都带 `user_id`，用于多用户隔离。
- `hwallet_wallets` 使用 `unique (user_id, chain_id)`，防止一个用户反复替换 HWallet。
- `hwallet_wallet_transfers` 使用 `user_id + lower(tx_hash)` 唯一索引，防止重复记账。
- `hwallet_agent_records` 和 `hwallet_agent_actions` 支持用户级 idempotency key。
- `hwallet_audit_events.money_moved` 默认 false，真实执行上线前不能默认变成 true。
- `hwallet_tee_signers.export_allowed` 被数据库约束锁定为 false。
- 所有业务表开启 RLS；当前阶段不写公开 policy，避免客户端 key 直接访问多用户数据。

## 迁移命令

先做本地静态检查：

```bash
npm run smoke:db-schema
npm run smoke:v2-storage-health
npm run db:migrate:postgres -- --dry-run
```

拿到 Supabase 连接串后执行：

```bash
DATABASE_URL="postgresql://..." npm run db:migrate:postgres
```

执行后再跑：

```bash
npm run verify:merge
```

验证 HWallet session/wallet adapter 真实连 Supabase：

```bash
DATABASE_URL="postgresql://..." npm run smoke:hwallet-postgres-session:live
```

这个 live smoke 会创建一个临时测试用户，先用 `dual` 模式写入，再用 `postgres` 模式回读，最后删除测试用户。

验证移动端 API 在 `dual` 模式下真实写入 Supabase：

```bash
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-api:live
```

这个 live smoke 会调用移动端 API 主路径：主页钱包绑定、充值对话、钱包刷新、交易核验和继续对话，然后从 Postgres 回读会话、钱包、资产快照、交易记录、钱包记录和知识笔记。

验证 staging/真机前的用户视角观察链路：

```bash
HWALLET_SESSION_STORE=dual npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-dual-observation:live
```

这个 live smoke 会先检查 `/api/v2/system/storage` 是否为 `dual` 且 Supabase 表齐，再走主页绑定、充值对话、交易核验、加入跟踪、移动端记忆、移动端审计和记录列表，并确认 Postgres 影子写入也包含钱包、转账、消息、审计和记录。

验证 postgres-only 生产读写链路：

```bash
HWALLET_SESSION_STORE=postgres npm run dev
AGENT_WALLET_BASE_URL=http://localhost:3000 npm run smoke:hwallet-postgres-api:live
```

这个 live smoke 要求 `/api/v2/system/storage` 明确返回 `postgres`，再从 App API 写入并读取钱包绑定、充值对话、交易核验、跟踪记录、移动端记忆、审计记录和记录列表，确认不依赖本地 JSONL 回读。

检查当前 V2 App 运行时是否真的处在目标存储模式：

```bash
curl http://localhost:3000/api/v2/system/storage
```

接口只返回模式、Supabase 是否配置、表是否齐和安全提示，不返回任何 `DATABASE_URL`、密码或密钥。真机或 staging 联调时先看这里，再跑用户路径。

Supabase 阶段收口总门禁：

```bash
npm run smoke:supabase-closeout
```

这个 smoke 会先做静态收口检查：HWallet V2 表、RLS、钱包唯一约束、`money_moved=false`
默认值、TEE 不可导出约束和所有 Supabase live smoke 入口是否存在。如果本地 `.env.local`
或环境变量里配置了 `DATABASE_URL`，它会自动升级为 live 检查：确认 `dual` / `postgres`
模式能看到完整 Supabase 表，`postgres` 模式达到 production-ready，所有 HWallet
业务表都启用 RLS，关键幂等索引、TEE 不可导出约束和 X Layer chain check 都在真实数据库中存在。
输出不会包含连接串、密码或密钥。

如果某台机器必须强制做真实 Supabase 验证，可以运行：

```bash
SUPABASE_CLOSEOUT_REQUIRE_LIVE=true npm run smoke:supabase-closeout
```

验证审计记录在 `dual` / `postgres` 模式下真实落库：

```bash
npm run smoke:audit-timeline:live
```

这个 live smoke 会写入钱包到账和模拟执行两类审计事件，确认 `money_moved=false`、交易 hash、钱包记录 id、模拟字段和多用户隔离都能从 Supabase 回读。

验证 phase-one 记录在 `dual` / `postgres` 模式下真实落库：

```bash
npm run smoke:phase-one-records:live
```

这个 live smoke 会写入跟踪卡和策略卡，确认幂等键、多用户隔离、按时间倒序和卡片 JSON 回读都能通过。

验证 Agent run/action 在 `dual` / `postgres` 模式下真实落库：

```bash
npm run smoke:agent-action-store:live
```

这个 live smoke 会写入一次 Agent run 和一次 action，确认动作幂等、多用户隔离、`money_moved=false` 和 Supabase 回读都能通过。

验证 market snapshots 在 `dual` / `postgres` 模式下真实落库：

```bash
npm run smoke:market-snapshots:live
```

这个 live smoke 会写入样本市场快照，确认 source provider、市场 provider、chain id、价格字段和按时间倒序回读都能通过。

## 下一步

1. 在 staging/真机联调时设置 `HWALLET_SESSION_STORE=dual`，观察真实用户路径持续写入 Supabase。
2. 先跑 `npm run smoke:hwallet-dual-observation:live`，确认 App API 和 Postgres 镜像一致。
3. 设置 `HWALLET_SESSION_STORE=postgres`，跑 `npm run smoke:hwallet-postgres-api:live` 验证 V2 App 能从 Supabase 读写会话和钱包数据。
4. 用 `/api/v2/system/storage` 做上线前存储模式确认。
5. 删除生产环境 JSONL 依赖。
