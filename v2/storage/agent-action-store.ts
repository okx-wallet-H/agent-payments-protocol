import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { getHWalletSessionStoreMode } from "./hwallet-postgres-session-store";
import { createPostgresClientOptions } from "./postgres-client-options";

export type AgentRunStatus = "completed" | "blocked" | "failed" | "running";
export type AgentActionStatus = "allowed" | "blocked" | "completed" | "failed";

export interface AgentRunRecord {
  id: string;
  userId: string;
  intent: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
}

export interface AgentActionRecord {
  id: string;
  userId: string;
  runId?: string;
  action: string;
  status: AgentActionStatus;
  capability: Record<string, unknown>;
  policyResult: Record<string, unknown>;
  idempotencyKey?: string;
  moneyMoved: false;
  createdAt: string;
}

type AgentRunInput = Omit<AgentRunRecord, "id" | "startedAt"> & {
  id?: string;
  startedAt?: string;
};

type AgentActionInput = Omit<AgentActionRecord, "id" | "createdAt" | "moneyMoved"> & {
  id?: string;
  createdAt?: string;
  moneyMoved?: false;
};

const dataDir = path.join(process.cwd(), ".agent-wallet-data");
const runsFile = path.join(dataDir, "agent-runs.jsonl");
const actionsFile = path.join(dataDir, "agent-actions.jsonl");
let agentActionPool: Pool | undefined;

export async function saveAgentRun(input: AgentRunInput): Promise<AgentRunRecord> {
  const userId = requireAgentUserId(input.userId);
  const run: AgentRunRecord = {
    id: input.id || crypto.randomUUID(),
    userId,
    intent: input.intent,
    status: input.status,
    input: input.input,
    output: input.output,
    startedAt: input.startedAt || new Date().toISOString(),
    finishedAt: input.finishedAt
  };

  const storeMode = getHWalletSessionStoreMode();
  if (storeMode !== "postgres") {
    await appendJsonl(runsFile, run);
  }
  if (storeMode !== "jsonl") {
    const postgresRun = await saveAgentRunToPostgres(run);
    if (storeMode === "postgres") return postgresRun;
  }
  return run;
}

export async function saveAgentAction(input: AgentActionInput): Promise<AgentActionRecord> {
  const userId = requireAgentUserId(input.userId);
  if (input.idempotencyKey) {
    const existing = await findAgentActionByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) return existing;
  }

  const action: AgentActionRecord = {
    id: input.id || crypto.randomUUID(),
    userId,
    runId: input.runId,
    action: input.action,
    status: input.status,
    capability: input.capability,
    policyResult: input.policyResult,
    idempotencyKey: input.idempotencyKey,
    moneyMoved: false,
    createdAt: input.createdAt || new Date().toISOString()
  };

  const storeMode = getHWalletSessionStoreMode();
  if (storeMode !== "postgres") {
    await appendJsonl(actionsFile, action);
  }
  if (storeMode !== "jsonl") {
    const postgresAction = await saveAgentActionToPostgres(action);
    if (storeMode === "postgres") return postgresAction;
  }
  return action;
}

function requireAgentUserId(userId: string | undefined): string {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!normalized) {
    throw new Error("Agent action userId is required");
  }
  return normalized;
}

export async function findAgentActionByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<AgentActionRecord | undefined> {
  if (getHWalletSessionStoreMode() === "postgres") {
    return findAgentActionByIdempotencyKeyFromPostgres(userId, idempotencyKey);
  }
  const actions = await listAgentActions(userId);
  return actions.find((action) => action.idempotencyKey === idempotencyKey);
}

export async function listAgentRuns(userId: string, limit = 30): Promise<AgentRunRecord[]> {
  if (getHWalletSessionStoreMode() === "postgres") {
    return listAgentRunsFromPostgres(userId, limit);
  }
  const runs = await readJsonl<Partial<AgentRunRecord>>(runsFile);
  return runs
    .map(withRunDefaults)
    .filter((run) => run.userId === userId)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, limit);
}

export async function listAgentActions(userId: string, limit = 30): Promise<AgentActionRecord[]> {
  if (getHWalletSessionStoreMode() === "postgres") {
    return listAgentActionsFromPostgres(userId, limit);
  }
  const actions = await readJsonl<Partial<AgentActionRecord>>(actionsFile);
  return actions
    .map(withActionDefaults)
    .filter((action) => action.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

async function saveAgentRunToPostgres(run: AgentRunRecord): Promise<AgentRunRecord> {
  const db = getAgentActionPool();
  await ensureAppUser(db, run.userId, run.startedAt);
  const result = await db.query(
    [
      "insert into hwallet_agent_runs",
      "(id, user_id, intent, status, input_json, output_json, started_at, finished_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8)",
      "on conflict (id) do update set",
      "status = excluded.status,",
      "output_json = excluded.output_json,",
      "finished_at = excluded.finished_at",
      "returning id, user_id, intent, status, input_json, output_json, started_at, finished_at"
    ].join(" "),
    [
      run.id,
      run.userId,
      run.intent,
      run.status,
      JSON.stringify(run.input),
      JSON.stringify(run.output),
      run.startedAt,
      run.finishedAt || null
    ]
  );
  return runFromRow(result.rows[0] as AgentRunRow);
}

async function saveAgentActionToPostgres(action: AgentActionRecord): Promise<AgentActionRecord> {
  const db = getAgentActionPool();
  await ensureAppUser(db, action.userId, action.createdAt);
  const result = await db.query(
    [
      "insert into hwallet_agent_actions",
      "(id, user_id, run_id, action, status, capability_json, policy_result_json, idempotency_key, money_moved, created_at)",
      "values ($1,$2,$3,$4,$5,$6,$7,$8,false,$9)",
      "on conflict (user_id, idempotency_key) where idempotency_key is not null",
      "do update set idempotency_key = excluded.idempotency_key",
      "returning id, user_id, run_id, action, status, capability_json, policy_result_json, idempotency_key, money_moved, created_at"
    ].join(" "),
    [
      action.id,
      action.userId,
      action.runId || null,
      action.action,
      action.status,
      JSON.stringify(action.capability),
      JSON.stringify(action.policyResult),
      action.idempotencyKey || null,
      action.createdAt
    ]
  );
  return actionFromRow(result.rows[0] as AgentActionRow);
}

async function findAgentActionByIdempotencyKeyFromPostgres(
  userId: string,
  idempotencyKey: string
): Promise<AgentActionRecord | undefined> {
  const result = await getAgentActionPool().query(
    [
      "select id, user_id, run_id, action, status, capability_json, policy_result_json, idempotency_key, money_moved, created_at",
      "from hwallet_agent_actions",
      "where user_id = $1 and idempotency_key = $2",
      "order by created_at desc",
      "limit 1"
    ].join(" "),
    [userId, idempotencyKey]
  );
  if (!result.rowCount) return undefined;
  return actionFromRow(result.rows[0] as AgentActionRow);
}

async function listAgentRunsFromPostgres(userId: string, limit = 30): Promise<AgentRunRecord[]> {
  const result = await getAgentActionPool().query(
    [
      "select id, user_id, intent, status, input_json, output_json, started_at, finished_at",
      "from hwallet_agent_runs",
      "where user_id = $1",
      "order by started_at desc",
      "limit $2"
    ].join(" "),
    [userId, limit]
  );
  return result.rows.map((row: AgentRunRow) => runFromRow(row));
}

async function listAgentActionsFromPostgres(userId: string, limit = 30): Promise<AgentActionRecord[]> {
  const result = await getAgentActionPool().query(
    [
      "select id, user_id, run_id, action, status, capability_json, policy_result_json, idempotency_key, money_moved, created_at",
      "from hwallet_agent_actions",
      "where user_id = $1",
      "order by created_at desc",
      "limit $2"
    ].join(" "),
    [userId, limit]
  );
  return result.rows.map((row: AgentActionRow) => actionFromRow(row));
}

async function ensureAppUser(db: Pool, userId: string, timestamp: string): Promise<void> {
  await db.query(
    [
      "insert into app_users (id, created_at, updated_at)",
      "values ($1,$2,$2)",
      "on conflict (id) do update set updated_at = greatest(app_users.updated_at, excluded.updated_at)"
    ].join(" "),
    [userId, timestamp]
  );
}

async function appendJsonl(file: string, value: unknown): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

async function readJsonl<T>(file: string): Promise<T[]> {
  const raw = await readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function getAgentActionPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("HWALLET_SESSION_STORE requires DATABASE_URL before using the Postgres agent action store.");
  }
  agentActionPool ||= new Pool(createPostgresClientOptions(databaseUrl));
  return agentActionPool;
}

function withRunDefaults(input: Partial<AgentRunRecord>): AgentRunRecord {
  return {
    id: input.id || crypto.randomUUID(),
    userId: input.userId || "demo-user",
    intent: input.intent || "",
    status: isRunStatus(input.status) ? input.status : "completed",
    input: readJsonObject(input.input),
    output: readJsonObject(input.output),
    startedAt: input.startedAt || new Date().toISOString(),
    finishedAt: input.finishedAt
  };
}

function withActionDefaults(input: Partial<AgentActionRecord>): AgentActionRecord {
  return {
    id: input.id || crypto.randomUUID(),
    userId: input.userId || "demo-user",
    runId: input.runId,
    action: input.action || "unknown",
    status: isActionStatus(input.status) ? input.status : "completed",
    capability: readJsonObject(input.capability),
    policyResult: readJsonObject(input.policyResult),
    idempotencyKey: input.idempotencyKey,
    moneyMoved: false,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function runFromRow(row: AgentRunRow): AgentRunRecord {
  return withRunDefaults({
    id: String(row.id || ""),
    userId: String(row.user_id || "demo-user"),
    intent: String(row.intent || ""),
    status: String(row.status || "completed") as AgentRunStatus,
    input: readJsonObject(row.input_json),
    output: readJsonObject(row.output_json),
    startedAt: toIso(row.started_at),
    finishedAt: row.finished_at ? toIso(row.finished_at) : undefined
  });
}

function actionFromRow(row: AgentActionRow): AgentActionRecord {
  return withActionDefaults({
    id: String(row.id || ""),
    userId: String(row.user_id || "demo-user"),
    runId: typeof row.run_id === "string" ? row.run_id : undefined,
    action: String(row.action || "unknown"),
    status: String(row.status || "completed") as AgentActionStatus,
    capability: readJsonObject(row.capability_json),
    policyResult: readJsonObject(row.policy_result_json),
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : undefined,
    moneyMoved: false,
    createdAt: toIso(row.created_at)
  });
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isRunStatus(value: unknown): value is AgentRunStatus {
  return value === "completed" || value === "blocked" || value === "failed" || value === "running";
}

function isActionStatus(value: unknown): value is AgentActionStatus {
  return value === "allowed" || value === "blocked" || value === "completed" || value === "failed";
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

interface AgentRunRow {
  id?: unknown;
  user_id?: unknown;
  intent?: unknown;
  status?: unknown;
  input_json?: unknown;
  output_json?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
}

interface AgentActionRow {
  id?: unknown;
  user_id?: unknown;
  run_id?: unknown;
  action?: unknown;
  status?: unknown;
  capability_json?: unknown;
  policy_result_json?: unknown;
  idempotency_key?: unknown;
  money_moved?: unknown;
  created_at?: unknown;
}
