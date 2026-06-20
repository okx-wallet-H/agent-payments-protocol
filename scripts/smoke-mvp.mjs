#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(rootDir, "data", "db.json");
const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const keepData = process.argv.includes("--keep-data") || process.env.SMOKE_KEEP_DATA === "true";
const ownerUserId = `smoke-user-${Date.now()}`;
const createdAgentIds = [];

const requiredAuditTypes = [
  "agent.created",
  "vault.created",
  "intent.created",
  "execution.previewed",
  "execution.confirmed",
  "execution.simulated"
];

async function main() {
  await assertServerReady();

  try {
    const storage = await runStorageHealthPath();
    const executionGates = await runExecutionGatePath();
    const accessControl = await runAccessControlPath();
    const agentOwnerBoundary = await runAgentOwnerBoundaryPath(accessControl);
    const accessDenied = await runAccessDeniedPath();
    const happyPath = await runHappyPath();
    const chatPath = await runChatPath();
    const validationPath = await runValidationPath();
    const budgetBlock = await runBudgetBlockPath();
    const pausedBlock = await runPausedBlockPath();
    const confirmationLock = await runConfirmationLockPath();

    printResult({
      storage,
      executionGates,
      accessControl,
      agentOwnerBoundary,
      accessDenied,
      happyPath,
      chatPath,
      validationPath,
      budgetBlock,
      pausedBlock,
      confirmationLock
    });
  } finally {
    if (createdAgentIds.length > 0 && !keepData && baseUrl.includes("localhost")) {
      await cleanupLocalSmokeData(createdAgentIds);
    }
  }
}

async function runAccessControlPath() {
  const response = await get("/api/system/auth");
  const expectedOwnerGuard = process.env.SMOKE_EXPECT_OWNER_GUARD === "true";
  assertEqual(response.accessControl.requireOwner, expectedOwnerGuard, "owner guard mode");
  assertEqual(response.accessControl.enforcement, expectedOwnerGuard ? "owner_user_id" : "off", "access enforcement");
  return {
    requireOwner: response.accessControl.requireOwner,
    requirePrivyToken: response.accessControl.requirePrivyToken,
    enforcement: response.accessControl.enforcement,
    warningCount: response.accessControl.warnings.length
  };
}

async function runAgentOwnerBoundaryPath(accessControl) {
  const expectedAuthErrorStatus = accessControl.requirePrivyToken ? 401 : accessControl.requireOwner ? 403 : undefined;
  const list = expectedAuthErrorStatus
    ? await getRawAllowingError("/api/agents", expectedAuthErrorStatus)
    : await getRaw("/api/agents");

  if (!expectedAuthErrorStatus) {
    assertTruthy(Array.isArray(list.agents), "ownerless agent list shape");
    assertEqual(list.agents.length, 0, "ownerless agent list is empty");
  }

  const expectedCreateStatus = expectedAuthErrorStatus || 400;
  const denied = await postRawAllowingError(
    "/api/agents",
    {
      name: "Ownerless Smoke Agent",
      userWalletAddress: randomAddress()
    },
    expectedCreateStatus
  );
  const deniedError = String(denied.error || "");
  assertTruthy(
    deniedError.includes("ownerUserId is required") ||
      deniedError.includes("Missing Privy access token") ||
      deniedError.includes("owner guard is enabled"),
    "ownerless agent creation rejected"
  );

  return {
    ownerlessListStatus: expectedAuthErrorStatus || 200,
    ownerlessListCount: Array.isArray(list.agents) ? list.agents.length : undefined,
    ownerlessCreateStatus: expectedCreateStatus,
    ownerlessCreateError: denied.error
  };
}

async function runAccessDeniedPath() {
  if (process.env.SMOKE_EXPECT_OWNER_GUARD !== "true") {
    return {
      checked: false,
      reason: "Owner guard is not expected in this smoke run."
    };
  }

  const { agentId } = await createAgentWithVault("Smoke Access Denied Agent");
  const intentResponse = await createIntent(agentId, {
    amountOkb: 0.01,
    thesis: "Smoke test: verify wrong owner cannot execute."
  });
  const denied = await postAllowingError(
    `/api/agents/${agentId}/execute`,
    {
      intentId: intentResponse.intent.id,
      ownerUserId: "wrong-owner"
    },
    403
  );
  assertTruthy(denied.error?.includes("Forbidden"), "wrong owner forbidden error");

  const readDenied = await getAllowingError(`/api/agents/${agentId}/audit`, 403, "wrong-owner");
  assertTruthy(readDenied.error?.includes("Forbidden"), "wrong owner read forbidden error");

  return {
    checked: true,
    agentId,
    status: 403,
    writeError: denied.error,
    readError: readDenied.error
  };
}

async function runExecutionGatePath() {
  const response = await get("/api/system/execution");
  assertEqual(response.execution.canBroadcastTransactions, false, "default broadcast gate");
  assertTruthy(response.execution.requiredForBroadcast.includes("AGENT_WALLET_REAL_EXECUTION=true"), "real execution gate");
  return {
    canBroadcastTransactions: response.execution.canBroadcastTransactions,
    pluginLiveTradingEnabled: response.execution.pluginLiveTradingEnabled,
    realExecutionEnabled: response.execution.realExecutionEnabled,
    publicTradingApiConfigured: response.execution.publicTradingApiConfigured,
    warningCount: response.execution.warnings.length
  };
}

async function runStorageHealthPath() {
  const response = await get("/api/system/storage");
  assertTruthy(response.storage?.provider, "storage provider");
  assertEqual(response.storage.productionReady, false, "local storage production readiness");
  assertTruthy(Array.isArray(response.storage.warnings), "storage warnings");
  return {
    provider: response.storage.provider,
    productionReady: response.storage.productionReady,
    warningCount: response.storage.warnings.length,
    counts: response.counts
  };
}

async function runHappyPath() {
  const { agentId, vaultAddress } = await createAgentWithVault("Smoke Test Agent");
  const vaultSync = await post(`/api/agents/${agentId}/vault/sync`, {});
  assertTruthy(vaultSync.vault?.lastBalanceSyncAt, "happy path vault sync timestamp");
  const intentResponse = await createIntent(agentId, {
    amountOkb: 0.01,
    thesis: "Smoke test: verify MVP can create a policy-checked prediction intent through the plugin path."
  });

  assertEqual(intentResponse.intent.status, "approved", "happy path intent status");

  const previewResponse = await post(`/api/agents/${agentId}/preview`, {
    intentId: intentResponse.intent.id
  });
  const preview = previewResponse.preview;
  assertEqual(preview.mode, "paper", "happy path preview mode");
  assertEqual(preview.safetySummary?.willMoveFunds, false, "happy path paper preview fund movement");
  assertTruthy(preview.safetySummary?.title, "happy path safety summary title");
  assertTruthy(preview.confirmationCode, "happy path confirmation code");

  const confirmResponse = await post(`/api/agents/${agentId}/preview/confirm`, {
    previewId: preview.id,
    confirmationText: preview.confirmationCode,
    confirmedBy: ownerUserId
  });
  assertEqual(confirmResponse.preview.confirmationStatus, "confirmed", "happy path confirmation status");

  const executeResponse = await post(`/api/agents/${agentId}/execute`, {
    intentId: intentResponse.intent.id,
    previewId: preview.id,
    ownerUserId
  });
  assertEqual(executeResponse.execution.status, "simulated", "happy path execution status");
  assertEqual(executeResponse.execution.provider, "polymarket", "happy path execution provider");

  const auditTypes = await getAuditTypes(agentId);
  for (const type of requiredAuditTypes) {
    assertTruthy(auditTypes.includes(type), `happy path audit type ${type}`);
  }

  return {
    agentId,
    vaultAddress,
    vaultBalanceSnapshotOkb: vaultSync.vault.balanceSnapshotOkb,
    intentStatus: intentResponse.intent.status,
    previewMode: preview.mode,
    safetyTitle: preview.safetySummary.title,
    willMoveFunds: preview.safetySummary.willMoveFunds,
    confirmationStatus: confirmResponse.preview.confirmationStatus,
    executionStatus: executeResponse.execution.status,
    auditTypes: auditTypes.slice(0, 8)
  };
}

async function runValidationPath() {
  const { agentId } = await createAgentWithVault("Smoke Validation Agent");

  const invalidIntent = await postAllowingError(
    `/api/agents/${agentId}/intents`,
    { amountOkb: -1, provider: "polymarket_plugin", market: "polymarket-world-cup-2026" },
    400
  );
  assertTruthy(invalidIntent.error?.includes("amountOkb"), "invalid intent amount error");

  const invalidRun = await postAllowingError(`/api/agents/${agentId}/run`, { amountOkb: "not-a-number" }, 400);
  assertTruthy(invalidRun.error?.includes("amountOkb"), "invalid run amount error");

  const invalidPolicy = await postAllowingError(
    `/api/agents/${agentId}/policy`,
    { maxSingleSpendOkb: 0.03, dailyBudgetOkb: 0.01 },
    400
  );
  assertTruthy(invalidPolicy.error?.includes("dailyBudgetOkb"), "invalid policy budget error");

  return {
    agentId,
    invalidIntent: invalidIntent.error,
    invalidRun: invalidRun.error,
    invalidPolicy: invalidPolicy.error
  };
}

async function runChatPath() {
  const { agentId } = await createAgentWithVault("Smoke Chat Agent");
  await createIntent(agentId, {
    amountOkb: 0.01,
    thesis: "Smoke test: verify conversational backend can preview, confirm, and execute."
  });

  const previewChat = await post(`/api/agents/${agentId}/chat`, {
    content: "先给我方案",
    userId: ownerUserId
  });
  const preview = previewChat.agent.previews[0];
  assertTruthy(preview?.confirmationCode, "chat path confirmation code");
  assertEqual(preview.confirmationStatus, "pending", "chat path preview confirmation status");
  assertEqual(previewChat.messages[1].action, "preview_intent", "chat path preview action");

  const confirmChat = await post(`/api/agents/${agentId}/chat`, {
    content: `确认 ${preview.confirmationCode}`,
    userId: ownerUserId
  });
  assertEqual(confirmChat.agent.previews[0].confirmationStatus, "confirmed", "chat path confirmation status");
  assertEqual(confirmChat.messages[1].action, "confirm_preview", "chat path confirmation action");

  const executeChat = await post(`/api/agents/${agentId}/chat`, {
    content: "模拟执行一下",
    userId: ownerUserId
  });
  assertEqual(executeChat.agent.executions[0].status, "simulated", "chat path execution status");
  assertEqual(executeChat.messages[1].action, "execute_intent", "chat path execution action");
  assertTruthy(executeChat.agent.memory.counters.chatTurns >= 3, "chat path memory chat counter");
  assertTruthy(executeChat.agent.memory.counters.confirmations >= 1, "chat path memory confirmation counter");
  assertTruthy(executeChat.agent.memory.counters.executions >= 1, "chat path memory execution counter");

  const auditTypes = await getAuditTypes(agentId);
  assertTruthy(auditTypes.filter((type) => type === "agent.chat.message").length >= 3, "chat path audit messages");
  for (const type of ["execution.previewed", "execution.confirmed", "execution.simulated"]) {
    assertTruthy(auditTypes.includes(type), `chat path audit type ${type}`);
  }

  return {
    agentId,
    previewAction: previewChat.messages[1].action,
    confirmationStatus: confirmChat.agent.previews[0].confirmationStatus,
    executionStatus: executeChat.agent.executions[0].status,
    chatTurns: executeChat.agent.memory.counters.chatTurns,
    auditChatMessages: auditTypes.filter((type) => type === "agent.chat.message").length,
    actionAuditTypes: auditTypes.filter((type) =>
      ["execution.previewed", "execution.confirmed", "execution.simulated"].includes(type)
    )
  };
}

async function runBudgetBlockPath() {
  const { agentId } = await createAgentWithVault("Smoke Budget Block Agent");
  const intentResponse = await createIntent(agentId, {
    amountOkb: 0.03,
    thesis: "Smoke test: verify policy blocks an amount above max single spend."
  });

  assertEqual(intentResponse.intent.status, "blocked", "budget block intent status");
  assertTruthy(
    intentResponse.intent.riskNotes.some((note) => note.includes("exceeds max single spend")),
    "budget block risk note"
  );

  const executeResponse = await postAllowingError(
    `/api/agents/${agentId}/execute`,
    { intentId: intentResponse.intent.id, ownerUserId },
    403
  );
  assertEqual(executeResponse.execution.status, "blocked", "budget block execution status");

  return {
    agentId,
    intentStatus: intentResponse.intent.status,
    executionStatus: executeResponse.execution.status,
    riskNotes: intentResponse.intent.riskNotes
  };
}

async function runPausedBlockPath() {
  const { agentId } = await createAgentWithVault("Smoke Paused Agent");
  const intentResponse = await createIntent(agentId, {
    amountOkb: 0.01,
    thesis: "Smoke test: verify pausing an agent blocks execution."
  });
  assertEqual(intentResponse.intent.status, "approved", "paused path initial intent status");

  await post(`/api/agents/${agentId}/status`, { status: "paused" });
  const executeResponse = await postAllowingError(
    `/api/agents/${agentId}/execute`,
    { intentId: intentResponse.intent.id, ownerUserId },
    403
  );
  assertEqual(executeResponse.execution.status, "blocked", "paused block execution status");
  assertTruthy(executeResponse.execution.error?.includes("paused"), "paused block execution error");

  return {
    agentId,
    executionStatus: executeResponse.execution.status,
    error: executeResponse.execution.error
  };
}

async function runConfirmationLockPath() {
  const { agentId } = await createAgentWithVault("Smoke Confirmation Lock Agent");
  const intentResponse = await createIntent(agentId, {
    amountOkb: 0.01,
    thesis: "Smoke test: verify wrong confirmation code attempts lock the preview."
  });
  const previewResponse = await post(`/api/agents/${agentId}/preview`, {
    intentId: intentResponse.intent.id
  });
  const preview = previewResponse.preview;

  let lockResponse;
  for (let index = 0; index < preview.maxConfirmationAttempts; index += 1) {
    lockResponse = await postAllowingError(
      `/api/agents/${agentId}/preview/confirm`,
      {
        previewId: preview.id,
        confirmationText: "000000",
        confirmedBy: ownerUserId
      },
      index + 1 >= preview.maxConfirmationAttempts ? 423 : 400
    );
  }

  assertEqual(lockResponse.preview.confirmationStatus, "locked", "confirmation lock status");
  assertEqual(lockResponse.preview.confirmationAttempts, preview.maxConfirmationAttempts, "confirmation lock attempts");

  return {
    agentId,
    confirmationStatus: lockResponse.preview.confirmationStatus,
    confirmationAttempts: lockResponse.preview.confirmationAttempts
  };
}

async function createAgentWithVault(name) {
  const agentResponse = await post("/api/agents", {
    ownerUserId,
    name,
    userWalletAddress: randomAddress()
  });
  const agentId = agentResponse.agent.id;
  createdAgentIds.push(agentId);

  const vaultResponse = await post(`/api/agents/${agentId}/vault`, {
    address: randomAddress(),
    walletType: "aa_smart_account"
  });

  return {
    agentId,
    vaultAddress: vaultResponse.vault.address
  };
}

async function createIntent(agentId, overrides = {}) {
  return post(`/api/agents/${agentId}/intents`, {
    provider: "polymarket_plugin",
    market: "polymarket-world-cup-2026",
    side: "yes",
    amountOkb: 0.01,
    thesis: "Smoke test: verify MVP prediction intent.",
    marketProbability: 0.45,
    ...overrides
  });
}

async function getAuditTypes(agentId) {
  const auditResponse = await get(`/api/agents/${agentId}/audit`);
  return auditResponse.audit.map((event) => event.type);
}

async function assertServerReady() {
  let response;
  try {
    response = await fetch(baseUrl);
  } catch {
    throw new Error(`Server is not reachable at ${baseUrl}. Start it with "npm run dev" or set SMOKE_BASE_URL.`);
  }
  if (!response.ok) {
    throw new Error(`Server is not ready at ${baseUrl}. HTTP ${response.status}`);
  }
}

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: agentApiHeaders(pathname)
  });
  return parseResponse(response, pathname);
}

async function getRaw(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return parseResponse(response, pathname);
}

async function getAllowingError(pathname, expectedStatus, ownerOverride = ownerUserId) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: agentApiHeaders(pathname, ownerOverride)
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(
      `${pathname} expected HTTP ${expectedStatus}, got HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

async function getRawAllowingError(pathname, expectedStatus) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const data = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(
      `${pathname} expected HTTP ${expectedStatus}, got HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

async function post(pathname, body) {
  const nextBody =
    pathname.startsWith("/api/agents/") && body && typeof body === "object" && !Array.isArray(body)
      ? { ownerUserId, ...body }
      : body;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...agentApiHeaders(pathname)
    },
    body: JSON.stringify(nextBody || {})
  });
  return parseResponse(response, pathname);
}

async function postAllowingError(pathname, body, expectedStatus) {
  const nextBody =
    pathname.startsWith("/api/agents/") && body && typeof body === "object" && !Array.isArray(body)
      ? { ownerUserId, ...body }
      : body;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...agentApiHeaders(pathname, String(nextBody?.ownerUserId || ownerUserId))
    },
    body: JSON.stringify(nextBody || {})
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(
      `${pathname} expected HTTP ${expectedStatus}, got HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

async function postRawAllowingError(pathname, body, expectedStatus) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(
      `${pathname} expected HTTP ${expectedStatus}, got HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

function agentApiHeaders(pathname, userId = ownerUserId) {
  return pathname.startsWith("/api/agents") ? { "x-owner-user-id": userId } : {};
}

async function parseResponse(response, pathname) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pathname} failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function cleanupLocalSmokeData(agentIds) {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const db = JSON.parse(raw);
    const ids = new Set(agentIds);
    db.agents = (db.agents || []).filter((agent) => !ids.has(agent.id));
    db.audit = (db.audit || []).filter((event) => !ids.has(event.agentId));
    await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
  } catch (error) {
    console.warn(`Smoke cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function randomAddress() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(value, label) {
  if (!value) {
    throw new Error(`${label}: expected a truthy value, got ${JSON.stringify(value)}`);
  }
}

function printResult(result) {
  console.log("Agent Wallet MVP acceptance smoke test passed.");
  console.log(JSON.stringify(result, null, 2));
  if (!keepData && baseUrl.includes("localhost")) {
    console.log("Local smoke data cleaned up. Use --keep-data to preserve it.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
