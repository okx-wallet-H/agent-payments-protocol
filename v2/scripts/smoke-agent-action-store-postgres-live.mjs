import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live agent action store Postgres smoke.");
  process.exit(1);
}

const userId = `agent-action-live-${Date.now()}`;
const otherUserId = `${userId}-other`;
const idempotencyKey = `action-${userId}-simulate`;
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));

const {
  findAgentActionByIdempotencyKey,
  listAgentActions,
  listAgentRuns,
  saveAgentAction,
  saveAgentRun
} = await import("../storage/agent-action-store.ts");

try {
  process.env.HWALLET_SESSION_STORE = "dual";

  const run = await saveAgentRun({
    userId,
    intent: "用户要求 Agent 模拟预测市场",
    status: "completed",
    input: {
      text: "先模拟一下",
      marketId: "worldcup-spain"
    },
    output: {
      action: "simulate",
      mode: "dry_run",
      moneyMoved: false
    },
    finishedAt: new Date().toISOString()
  });

  const action = await saveAgentAction({
    userId,
    runId: run.id,
    action: "simulate",
    status: "completed",
    capability: {
      walletReady: true,
      fundsReady: true,
      onchainSkill: {
        status: "allowed",
        mode: "dry_run",
        capability: "okx-onchainos-skills"
      },
      liveExecution: {
        enabled: false,
        reason: "MVP 阶段关闭真实下单"
      }
    },
    policyResult: {
      status: "allow",
      action: "simulate",
      reason: "Policy allow"
    },
    idempotencyKey
  });

  assert(run.status === "completed", "dual write returns run");
  assert(action.status === "completed", "dual write returns action");

  process.env.HWALLET_SESSION_STORE = "postgres";

  const duplicate = await saveAgentAction({
    userId,
    runId: run.id,
    action: "simulate",
    status: "completed",
    capability: {},
    policyResult: {},
    idempotencyKey
  });
  const found = await findAgentActionByIdempotencyKey(userId, idempotencyKey);
  const runs = await listAgentRuns(userId);
  const actions = await listAgentActions(userId);
  const otherRuns = await listAgentRuns(otherUserId);
  const otherActions = await listAgentActions(otherUserId);

  assert(runs.some((item) => item.id === run.id), "postgres lists run");
  assert(actions.some((item) => item.id === action.id), "postgres lists action");
  assert(duplicate.id === action.id, "postgres idempotency returns existing action");
  assert(found?.id === action.id, "postgres finds action by idempotency key");
  assert(actions.every((item) => item.moneyMoved === false), "postgres preserves money_moved false");
  assert(actions[0].createdAt >= actions[actions.length - 1].createdAt, "postgres sorts newest first");
  assert(otherRuns.length === 0, "postgres keeps other user runs isolated");
  assert(otherActions.length === 0, "postgres keeps other user actions isolated");

  console.log(JSON.stringify({
    ok: true,
    userId,
    checks: [
      "dual write completed",
      "postgres read returned run",
      "postgres read returned action",
      "postgres idempotency returned existing action",
      "postgres find by idempotency works",
      "money movement remains false",
      "other user isolated"
    ]
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = any($1)", [[userId, otherUserId]]).catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.env.HWALLET_SESSION_STORE = "jsonl";
}

async function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      if (key !== "DATABASE_URL") continue;
      process.env.DATABASE_URL = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      return;
    }
  }
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function assert(condition, label) {
  if (!condition) throw new Error(`Live agent action store Postgres smoke failed: ${label}`);
}
