import {
  findAgentActionByIdempotencyKey,
  listAgentActions,
  listAgentRuns,
  saveAgentAction,
  saveAgentRun
} from "../storage/agent-action-store.ts";

process.env.HWALLET_SESSION_STORE = "jsonl";

const userId = `agent-action-smoke-${Date.now()}`;
const otherUserId = `${userId}-other`;
const idempotencyKey = `action-${userId}-track`;

const run = await saveAgentRun({
  userId,
  intent: "用户要求 Agent 跟踪一个预测市场",
  status: "completed",
  input: {
    text: "加入跟踪",
    marketId: "worldcup-spain"
  },
  output: {
    action: "track",
    moneyMoved: false
  },
  finishedAt: new Date().toISOString()
});

const action = await saveAgentAction({
  userId,
  runId: run.id,
  action: "track",
  status: "completed",
  capability: {
    onchainSkill: {
      status: "allowed",
      mode: "observe"
    },
    liveExecution: {
      enabled: false
    }
  },
  policyResult: {
    status: "allow",
    reason: "Policy allow"
  },
  idempotencyKey
});

const duplicate = await saveAgentAction({
  userId,
  runId: run.id,
  action: "track",
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
const missingRunUser = await rejectsWithUserBoundary(() => saveAgentRun({
  intent: "missing user should fail",
  status: "completed",
  input: {},
  output: {},
  finishedAt: new Date().toISOString()
}));
const missingActionUser = await rejectsWithUserBoundary(() => saveAgentAction({
  runId: run.id,
  action: "track",
  status: "completed",
  capability: {},
  policyResult: {},
  idempotencyKey: `missing-user-${idempotencyKey}`
}));

assert(runs.some((item) => item.id === run.id), "lists saved run");
assert(actions.some((item) => item.id === action.id), "lists saved action");
assert(action.moneyMoved === false, "action never claims money movement");
assert(duplicate.id === action.id, "idempotency returns existing action");
assert(found?.id === action.id, "finds action by idempotency key");
assert(actions[0].createdAt >= actions[actions.length - 1].createdAt, "actions sorted newest first");
assert(otherRuns.length === 0, "other user runs isolated");
assert(otherActions.length === 0, "other user actions isolated");
assert(missingRunUser, "missing run user is rejected");
assert(missingActionUser, "missing action user is rejected");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "jsonl run saved",
    "jsonl action saved",
    "money movement false",
    "idempotency returns existing action",
    "find by idempotency works",
    "actions sort newest first",
    "other user isolated",
    "missing run user rejected",
    "missing action user rejected"
  ],
  runId: run.id,
  actionId: action.id
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent action store smoke failed: ${label}`);
}

async function rejectsWithUserBoundary(callback) {
  try {
    await callback();
    return false;
  } catch (error) {
    return error instanceof Error && error.message === "Agent action userId is required";
  }
}
