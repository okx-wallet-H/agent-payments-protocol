import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live HWallet dual API smoke.");
  process.exit(1);
}

const baseUrl = process.env.AGENT_WALLET_BASE_URL || "http://localhost:3000";
const userId = `hwallet-dual-api-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = "0x59029AD72744Ea033a4Ccb261Ec79569e158209e";
const txHash = "0xbad718fc3c07ca668b564c54f7c88afe7b2877d7d5c973f30735ad3abbca0747";
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));
const { loadUserSessionFromPostgres } = await import("../storage/hwallet-postgres-session-store.ts");

try {
  await assertServerIsDualMode();

  const home = await getJson(
    `/api/v2/mobile/home?userId=${encodeURIComponent(userId)}&walletAddress=${encodeURIComponent(walletAddress)}`
  );
  assert(home.wallet?.address === walletAddress, "home binds the HWallet address");

  const recharge = await postJson("/api/v2/phase-one", {
    userId,
    walletAddress,
    text: "我要充值"
  });
  assert(recharge.mobileTurn?.goalType === "wallet_receive", "chat returns receive-card flow");

  const refresh = await postJson("/api/v2/mobile/wallet/refresh", {
    userId,
    walletAddress
  });
  assert(refresh.wallet?.address === walletAddress, "wallet refresh keeps the same HWallet");

  const verifyTx = await postJson("/api/v2/mobile/wallet/verify-tx", {
    userId,
    walletAddress,
    txHash
  });
  assert(verifyTx.verification?.txHash === txHash, "tx verification routes through wallet API");

  const followUp = await postJson("/api/v2/phase-one", {
    userId,
    text: "好了，继续"
  });
  assert(followUp.mobileTurn?.goalType, "follow-up returns an Agent turn");

  const postgresMemory = await loadUserSessionFromPostgres(userId);
  assert(
    normalizeHex(postgresMemory?.walletAddress) === normalizeHex(walletAddress),
    "postgres stores wallet binding"
  );
  assert(postgresMemory?.walletAssetSnapshot?.USDT0 !== undefined, "postgres stores asset snapshot");
  assert(
    postgresMemory?.recentMessages.some((message) => message.role === "user" && message.text.includes("我要充值")),
    "postgres stores user chat message"
  );
  assert(
    postgresMemory?.recentMessages.some((message) => message.role === "agent"),
    "postgres stores Agent reply"
  );
  assert(
    postgresMemory?.verifiedWalletTransfers.some((transfer) => normalizeHex(transfer.txHash) === normalizeHex(txHash)),
    "postgres stores verified transfer"
  );
  assert(
    postgresMemory?.walletRecords.some((record) => normalizeHex(record.id) === normalizeHex(`wallet-tx-${txHash}`)),
    "postgres stores wallet record linked to verified transfer"
  );
  assert(
    postgresMemory?.knowledgeNotes.some((note) => /X Layer|HWallet|真实下单|充值/.test(note)),
    "postgres stores wallet knowledge notes"
  );

  const isolatedMemory = await loadUserSessionFromPostgres(otherUserId);
  assert(!isolatedMemory, "postgres keeps other user isolated");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    userId,
    checks: [
      "server dual mode confirmed",
      "mobile home binds wallet",
      "chat receive flow writes through API",
      "wallet refresh writes through API",
      "tx verification writes through API",
      "postgres readback returns wallet binding",
      "postgres readback returns asset snapshot",
      "postgres readback returns chat messages",
      "postgres readback returns verified transfer",
      "postgres readback returns wallet record",
      "postgres readback returns knowledge notes",
      "other user remains isolated"
    ]
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = any($1)", [[userId, otherUserId]]).catch(() => undefined);
  await pool.end().catch(() => undefined);
}

async function assertServerIsDualMode() {
  const probeUserId = `${userId}-probe-${randomBytes(3).toString("hex")}`;
  const probeWallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  await getJson(`/api/v2/mobile/home?userId=${encodeURIComponent(probeUserId)}&walletAddress=${probeWallet}`);
  const probeMemory = await loadUserSessionFromPostgres(probeUserId);
  await pool.query("delete from app_users where id = $1", [probeUserId]).catch(() => undefined);
  assert(
    probeMemory?.walletAddress === probeWallet,
    "server is not writing to Postgres; start it with HWALLET_SESSION_STORE=dual"
  );
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return readJsonResponse(response, path);
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return readJsonResponse(response, path);
}

async function readJsonResponse(response, path) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.error || data.message || ""}`.trim());
  }
  return data;
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
      const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      if (!process.env[key]) process.env[key] = value;
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
  if (!condition) throw new Error(`Live HWallet dual API smoke failed: ${label}`);
}

function normalizeHex(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}
