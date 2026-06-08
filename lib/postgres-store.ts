import { Pool, type PoolClient } from "pg";
import { normalizeAgentMemory } from "./agent-memory";
import type {
  Agent,
  AgentMemory,
  AgentVault,
  AuditEvent,
  Database,
  ExecutionPreview,
  ExecutionRecord,
  TradeIntent
} from "./types";
import type { AgentStore } from "./store";
import { normalizeAuditEvents } from "./store";

export function createPostgresStore(databaseUrl: string): AgentStore {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    info() {
      return {
        provider: "postgres",
        productionReady: false,
        warnings: [
          "Postgres store is wired behind AGENT_STORE=postgres.",
          "Run database/schema.sql before enabling this provider.",
          "Keep live trading disabled until database backups, monitoring, and migration checks are in place."
        ]
      };
    },
    async readDb() {
      return readDb(pool);
    },
    async writeDb(db) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("delete from audit_events");
        await client.query("delete from agents");
        for (const agent of db.agents) await upsertAgent(client, agent);
        for (const event of db.audit) await insertAudit(client, event);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async listAgents() {
      return listAgents(pool);
    },
    async getAgent(id) {
      const agents = await listAgents(pool, id);
      return agents[0];
    },
    async saveAgent(agent, event) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const nextAgent = { ...agent, updatedAt: new Date().toISOString() };
        await upsertAgent(client, nextAgent);
        for (const item of normalizeAuditEvents(event)) await insertAudit(client, item);
        await client.query("commit");
        return nextAgent;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async addAudit(event) {
      await insertAudit(pool, event);
    },
    async listAudit(agentId) {
      const result = await pool.query(
        "select id, agent_id, type, message, metadata, created_at from audit_events where agent_id = $1 order by created_at desc",
        [agentId]
      );
      return result.rows.map(mapAuditEvent);
    }
  };
}

async function readDb(pool: Pool): Promise<Database> {
  const [agents, auditResult] = await Promise.all([
    listAgents(pool),
    pool.query("select id, agent_id, type, message, metadata, created_at from audit_events order by created_at desc")
  ]);
  return {
    agents,
    audit: auditResult.rows.map(mapAuditEvent)
  };
}

async function listAgents(pool: Pool, agentId?: string): Promise<Agent[]> {
  const agentResult = await pool.query(
    [
      "select a.*, p.*, m.*, v.chain_id, v.chain_name, v.address as vault_address, v.display_address,",
      "v.wallet_type, v.balance_snapshot_okb, v.last_balance_sync_at",
      "from agents a",
      "join agent_policies p on p.agent_id = a.id",
      "join agent_memories m on m.agent_id = a.id",
      "left join agent_vaults v on v.agent_id = a.id",
      agentId ? "where a.id = $1" : "",
      "order by a.created_at desc"
    ].join(" "),
    agentId ? [agentId] : []
  );
  const agents = await Promise.all(agentResult.rows.map((row) => hydrateAgent(pool, row)));
  return agents;
}

async function hydrateAgent(pool: Pool, row: Record<string, any>): Promise<Agent> {
  const agentId = String(row.id);
  const [messages, runs, intents, previews, executions] = await Promise.all([
    pool.query("select * from agent_messages where agent_id = $1 order by created_at desc", [agentId]),
    pool.query("select * from agent_runs where agent_id = $1 order by created_at desc", [agentId]),
    pool.query("select * from trade_intents where agent_id = $1 order by created_at desc", [agentId]),
    pool.query("select * from execution_previews where agent_id = $1 order by created_at desc", [agentId]),
    pool.query("select * from execution_records where agent_id = $1 order by created_at desc", [agentId])
  ]);

  return {
    id: agentId,
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    status: row.status,
    strategyProfile: String(row.strategy_profile),
    executionMode: row.execution_mode,
    userWalletAddress: row.user_wallet_address || undefined,
    vault: row.vault_address
      ? ({
          chainId: Number(row.chain_id),
          chainName: row.chain_name,
          address: row.vault_address,
          displayAddress: row.display_address,
          walletType: row.wallet_type,
          balanceSnapshotOkb: String(row.balance_snapshot_okb),
          lastBalanceSyncAt: toIso(row.last_balance_sync_at)
        } as AgentVault)
      : undefined,
    policy: {
      maxSingleSpendOkb: Number(row.max_single_spend_okb),
      dailyBudgetOkb: Number(row.daily_budget_okb),
      dailyLossLimitOkb: Number(row.daily_loss_limit_okb),
      allowedMarkets: row.allowed_markets || [],
      allowedTokens: row.allowed_tokens || [],
      expiresAt: toIso(row.expires_at),
      revoked: Boolean(row.revoked)
    },
    memory: normalizeAgentMemory({
      userPreferences: row.user_preferences || [],
      riskProfile: row.risk_profile || {},
      strategyHints: row.strategy_hints || [],
      recentLessons: row.recent_lessons || [],
      counters: row.counters || {},
      updatedAt: toIso(row.updated_at)
    }),
    messages: messages.rows.map((message) => ({
      id: String(message.id),
      agentId,
      role: message.role,
      content: message.content,
      action: message.action || undefined,
      decision: message.decision || undefined,
      toolResult: message.tool_result || undefined,
      createdAt: toIso(message.created_at)
    })),
    runs: runs.rows.map((run) => ({
      id: String(run.id),
      agentId,
      status: run.status,
      goal: run.goal,
      router: run.router,
      observedMarketCount: Number(run.observed_market_count),
      selectedMarketId: run.selected_market_id || undefined,
      selectedQuestion: run.selected_question || undefined,
      selectionReason: run.selection_reason,
      intentId: run.intent_id || undefined,
      previewId: run.preview_id || undefined,
      riskNotes: run.risk_notes || [],
      createdAt: toIso(run.created_at)
    })),
    intents: intents.rows.map(mapTradeIntent),
    previews: previews.rows.map(mapExecutionPreview),
    executions: executions.rows.map(mapExecutionRecord),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function upsertAgent(client: PoolClient, agent: Agent): Promise<void> {
  const memory = normalizeAgentMemory(agent.memory);
  await client.query(
    "insert into app_users (id, created_at, updated_at) values ($1, now(), now()) on conflict (id) do update set updated_at = now()",
    [agent.ownerUserId]
  );
  await client.query(
    [
      "insert into agents (id, owner_user_id, name, status, strategy_profile, execution_mode, user_wallet_address, created_at, updated_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      "on conflict (id) do update set owner_user_id=$2, name=$3, status=$4, strategy_profile=$5, execution_mode=$6, user_wallet_address=$7, updated_at=$9"
    ].join(" "),
    [
      agent.id,
      agent.ownerUserId,
      agent.name,
      agent.status,
      agent.strategyProfile,
      agent.executionMode,
      agent.userWalletAddress || null,
      agent.createdAt,
      agent.updatedAt
    ]
  );
  await upsertVault(client, agent);
  await upsertPolicy(client, agent);
  await upsertMemory(client, agent.id, memory);
  await replaceChildren(client, agent);
}

async function upsertVault(client: PoolClient, agent: Agent): Promise<void> {
  if (!agent.vault) {
    await client.query("delete from agent_vaults where agent_id = $1", [agent.id]);
    return;
  }
  const vault = agent.vault;
  await client.query(
    [
      "insert into agent_vaults (agent_id, chain_id, chain_name, address, display_address, wallet_type, balance_snapshot_okb, last_balance_sync_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8)",
      "on conflict (agent_id) do update set chain_id=$2, chain_name=$3, address=$4, display_address=$5, wallet_type=$6, balance_snapshot_okb=$7, last_balance_sync_at=$8"
    ].join(" "),
    [
      agent.id,
      vault.chainId,
      vault.chainName,
      vault.address,
      vault.displayAddress,
      vault.walletType,
      vault.balanceSnapshotOkb,
      vault.lastBalanceSyncAt
    ]
  );
}

async function upsertPolicy(client: PoolClient, agent: Agent): Promise<void> {
  const policy = agent.policy;
  await client.query(
    [
      "insert into agent_policies (agent_id, max_single_spend_okb, daily_budget_okb, daily_loss_limit_okb, allowed_markets, allowed_tokens, expires_at, revoked, updated_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8,now())",
      "on conflict (agent_id) do update set max_single_spend_okb=$2, daily_budget_okb=$3, daily_loss_limit_okb=$4, allowed_markets=$5, allowed_tokens=$6, expires_at=$7, revoked=$8, updated_at=now()"
    ].join(" "),
    [
      agent.id,
      policy.maxSingleSpendOkb,
      policy.dailyBudgetOkb,
      policy.dailyLossLimitOkb,
      policy.allowedMarkets,
      policy.allowedTokens,
      policy.expiresAt,
      policy.revoked
    ]
  );
}

async function upsertMemory(client: PoolClient, agentId: string, memory: AgentMemory): Promise<void> {
  await client.query(
    [
      "insert into agent_memories (agent_id, user_preferences, risk_profile, strategy_hints, recent_lessons, counters, updated_at)",
      "values ($1,$2,$3,$4,$5,$6,$7)",
      "on conflict (agent_id) do update set user_preferences=$2, risk_profile=$3, strategy_hints=$4, recent_lessons=$5, counters=$6, updated_at=$7"
    ].join(" "),
    [
      agentId,
      JSON.stringify(memory.userPreferences),
      JSON.stringify(memory.riskProfile),
      JSON.stringify(memory.strategyHints),
      JSON.stringify(memory.recentLessons),
      JSON.stringify(memory.counters),
      memory.updatedAt
    ]
  );
}

async function replaceChildren(client: PoolClient, agent: Agent): Promise<void> {
  await client.query("delete from execution_records where agent_id = $1", [agent.id]);
  await client.query("delete from execution_previews where agent_id = $1", [agent.id]);
  await client.query("delete from trade_intents where agent_id = $1", [agent.id]);
  await client.query("delete from agent_runs where agent_id = $1", [agent.id]);
  await client.query("delete from agent_messages where agent_id = $1", [agent.id]);

  for (const message of agent.messages || []) {
    await client.query(
      "insert into agent_messages (id, agent_id, role, content, action, decision, tool_result, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        message.id,
        agent.id,
        message.role,
        message.content,
        message.action || null,
        json(message.decision),
        json(message.toolResult),
        message.createdAt
      ]
    );
  }
  for (const run of agent.runs || []) {
    await client.query(
      [
        "insert into agent_runs (id, agent_id, status, goal, router, observed_market_count, selected_market_id, selected_question, selection_reason, intent_id, preview_id, risk_notes, created_at)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)"
      ].join(" "),
      [
        run.id,
        agent.id,
        run.status,
        run.goal,
        JSON.stringify(run.router),
        run.observedMarketCount,
        run.selectedMarketId || null,
        run.selectedQuestion || null,
        run.selectionReason,
        run.intentId || null,
        run.previewId || null,
        JSON.stringify(run.riskNotes),
        run.createdAt
      ]
    );
  }
  for (const intent of agent.intents || []) await insertIntent(client, intent);
  for (const preview of agent.previews || []) await insertPreview(client, preview);
  for (const execution of agent.executions || []) await insertExecution(client, execution);
}

async function insertIntent(client: PoolClient, intent: TradeIntent): Promise<void> {
  await client.query(
    [
      "insert into trade_intents (id, agent_id, market, market_source, side, amount_okb, confidence, expected_probability, market_probability, external_market_id, external_market_slug, external_question, plugin_name, tool_route, execution_plan, live_mode_required, preview_required, reasoning, status, risk_notes, created_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)"
    ].join(" "),
    [
      intent.id,
      intent.agentId,
      intent.market,
      intent.marketSource,
      intent.side,
      intent.amountOkb,
      intent.confidence,
      intent.expectedProbability,
      intent.marketProbability ?? null,
      intent.externalMarketId || null,
      intent.externalMarketSlug || null,
      intent.externalQuestion || null,
      intent.pluginName || null,
      json(intent.toolRoute),
      json(intent.executionPlan),
      intent.liveModeRequired ?? null,
      intent.previewRequired ?? null,
      intent.reasoning,
      intent.status,
      JSON.stringify(intent.riskNotes),
      intent.createdAt
    ]
  );
}

async function insertPreview(client: PoolClient, preview: ExecutionPreview): Promise<void> {
  await client.query(
    [
      "insert into execution_previews (id, agent_id, intent_id, provider, mode, market, side, amount_okb, estimated_cost_okb, estimated_gas_okb, price, tool_route, warnings, safety_summary, confirmation_text, confirmation_code, confirmation_status, confirmation_attempts, max_confirmation_attempts, confirmed_at, confirmed_by, expires_at, created_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)"
    ].join(" "),
    [
      preview.id,
      preview.agentId,
      preview.intentId,
      preview.provider,
      preview.mode,
      preview.market,
      preview.side,
      preview.amountOkb,
      preview.estimatedCostOkb,
      preview.estimatedGasOkb,
      preview.price ?? null,
      json(preview.toolRoute),
      JSON.stringify(preview.warnings),
      JSON.stringify(preview.safetySummary),
      preview.confirmationText || null,
      preview.confirmationCode || null,
      preview.confirmationStatus,
      preview.confirmationAttempts,
      preview.maxConfirmationAttempts,
      preview.confirmedAt || null,
      preview.confirmedBy || null,
      preview.expiresAt,
      preview.createdAt
    ]
  );
}

async function insertExecution(client: PoolClient, execution: ExecutionRecord): Promise<void> {
  await client.query(
    "insert into execution_records (id, agent_id, intent_id, status, tx_hash, cost_okb, error, explorer_url, provider, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      execution.id,
      execution.agentId,
      execution.intentId,
      execution.status,
      execution.txHash || null,
      execution.costOkb,
      execution.error || null,
      execution.explorerUrl || null,
      execution.provider || null,
      execution.createdAt
    ]
  );
}

async function insertAudit(clientOrPool: PoolClient | Pool, event: AuditEvent): Promise<void> {
  await clientOrPool.query(
    "insert into audit_events (id, agent_id, type, message, metadata, created_at) values ($1,$2,$3,$4,$5,$6)",
    [event.id, event.agentId, event.type, event.message, JSON.stringify(event.metadata), event.createdAt]
  );
}

function mapTradeIntent(row: Record<string, any>): TradeIntent {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    market: row.market,
    marketSource: row.market_source,
    side: row.side,
    amountOkb: Number(row.amount_okb),
    confidence: Number(row.confidence),
    expectedProbability: Number(row.expected_probability),
    marketProbability: row.market_probability === null ? undefined : Number(row.market_probability),
    externalMarketId: row.external_market_id || undefined,
    externalMarketSlug: row.external_market_slug || undefined,
    externalQuestion: row.external_question || undefined,
    pluginName: row.plugin_name || undefined,
    toolRoute: row.tool_route || undefined,
    executionPlan: row.execution_plan || undefined,
    liveModeRequired: row.live_mode_required ?? undefined,
    previewRequired: row.preview_required ?? undefined,
    reasoning: row.reasoning,
    status: row.status,
    riskNotes: row.risk_notes || [],
    createdAt: toIso(row.created_at)
  };
}

function mapExecutionPreview(row: Record<string, any>): ExecutionPreview {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    intentId: String(row.intent_id),
    provider: row.provider,
    mode: row.mode,
    market: row.market,
    side: row.side,
    amountOkb: Number(row.amount_okb),
    estimatedCostOkb: Number(row.estimated_cost_okb),
    estimatedGasOkb: Number(row.estimated_gas_okb),
    price: row.price === null ? undefined : Number(row.price),
    toolRoute: row.tool_route || undefined,
    warnings: row.warnings || [],
    safetySummary: row.safety_summary || {},
    confirmationText: row.confirmation_text || undefined,
    confirmationCode: row.confirmation_code || undefined,
    confirmationStatus: row.confirmation_status,
    confirmationAttempts: Number(row.confirmation_attempts),
    maxConfirmationAttempts: Number(row.max_confirmation_attempts),
    confirmedAt: row.confirmed_at ? toIso(row.confirmed_at) : undefined,
    confirmedBy: row.confirmed_by || undefined,
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at)
  };
}

function mapExecutionRecord(row: Record<string, any>): ExecutionRecord {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    intentId: String(row.intent_id),
    status: row.status,
    txHash: row.tx_hash || undefined,
    costOkb: Number(row.cost_okb),
    error: row.error || undefined,
    explorerUrl: row.explorer_url || undefined,
    provider: row.provider || undefined,
    createdAt: toIso(row.created_at)
  };
}

function mapAuditEvent(row: Record<string, any>): AuditEvent {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    type: row.type,
    message: row.message,
    metadata: row.metadata || {},
    createdAt: toIso(row.created_at)
  };
}

function json(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
