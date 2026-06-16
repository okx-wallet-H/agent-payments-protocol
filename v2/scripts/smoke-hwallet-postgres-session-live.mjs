import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresClientOptions } from "../../scripts/postgres-client-options.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for live HWallet Postgres session smoke.");
  process.exit(1);
}

const { loadUserSession, rememberUserSession } = await import("../storage/user-session-store.ts");

const userId = `hwallet-live-smoke-${Date.now()}`;
const otherUserId = `${userId}-other`;
const walletAddress = `0x${"1".repeat(40)}`;
const otherWalletAddress = `0x${"2".repeat(40)}`;
const txHash = `0x${randomBytes(32).toString("hex")}`;
const otherTxHash = `0x${randomBytes(32).toString("hex")}`;
const recordId = `live-smoke-wallet-record-${Date.now()}`;
const otherRecordId = `${recordId}-other`;
const userMarker = `user-a-marker-${randomBytes(4).toString("hex")}`;
const otherUserMarker = `user-b-marker-${randomBytes(4).toString("hex")}`;
const pool = new pg.Pool(createPostgresClientOptions(process.env.DATABASE_URL));

try {
  process.env.HWALLET_SESSION_STORE = "dual";

  const written = await rememberUserSession({
    userId,
    walletAddress,
    walletAssetSnapshot: {
      USDT0: "0.005",
      USDT: "0",
      OKB: "0.002"
    },
    walletRecords: [
      {
        id: recordId,
        title: "测试到账记录",
        note: `live smoke mirror write ${userMarker}`,
        status: "synced",
        createdAt: new Date().toISOString()
      }
    ],
    verifiedWalletTransfer: {
      txHash,
      status: "received",
      message: "live smoke transfer verified",
      explorerUrl: "https://www.oklink.com/xlayer/tx/live-smoke",
      chainId: 196,
      assetSymbol: "USDT0",
      amountLabel: "0.005",
      verifiedAt: new Date().toISOString()
    },
    userText: `测试 HWallet 数据库写入 ${userMarker}`,
    agentText: `已记录到 HWallet ${userMarker}`,
    knowledgeNotes: [`live smoke knowledge note ${userMarker}`]
  });

  const otherWritten = await rememberUserSession({
    userId: otherUserId,
    walletAddress: otherWalletAddress,
    walletAssetSnapshot: {
      USDT0: "0.011",
      USDT: "0",
      OKB: "0.003"
    },
    walletRecords: [
      {
        id: otherRecordId,
        title: "另一个用户到账记录",
        note: `live smoke mirror write ${otherUserMarker}`,
        status: "synced",
        createdAt: new Date().toISOString()
      }
    ],
    verifiedWalletTransfer: {
      txHash: otherTxHash,
      status: "received",
      message: `live smoke transfer verified ${otherUserMarker}`,
      explorerUrl: "https://www.oklink.com/xlayer/tx/live-smoke-other",
      chainId: 196,
      assetSymbol: "USDT0",
      amountLabel: "0.011",
      verifiedAt: new Date().toISOString()
    },
    userText: `测试另一个 HWallet 数据库写入 ${otherUserMarker}`,
    agentText: `已记录到另一个 HWallet ${otherUserMarker}`,
    knowledgeNotes: [`live smoke knowledge note ${otherUserMarker}`]
  });

  assert(written.walletAddress === walletAddress, "dual write returns wallet address");
  assert(written.verifiedWalletTransfers[0]?.txHash === txHash, "dual write remembers tx hash");
  assert(otherWritten.walletAddress === otherWalletAddress, "dual write returns other wallet address");
  assert(otherWritten.verifiedWalletTransfers[0]?.txHash === otherTxHash, "dual write remembers other tx hash");

  process.env.HWALLET_SESSION_STORE = "postgres";
  const loaded = await loadUserSession(userId);
  const otherLoaded = await loadUserSession(otherUserId);
  const missingLoaded = await loadUserSession(`${userId}-missing`);

  assert(loaded?.walletAddress === walletAddress, "postgres read returns wallet address");
  assert(loaded?.walletAssetSnapshot?.USDT0 === "0.005", "postgres read returns USDT0 snapshot");
  assert(loaded?.recentMessages.some((message) => message.text.includes(userMarker)), "postgres read returns user message");
  assert(loaded?.walletRecords.some((record) => record.id === recordId), "postgres read returns wallet record");
  assert(loaded?.verifiedWalletTransfers.some((transfer) => transfer.txHash === txHash), "postgres read returns verified transfer");
  assert(loaded?.knowledgeNotes.some((note) => note.includes(userMarker)), "postgres read returns knowledge note");
  assert(!sessionContains(loaded, otherUserMarker), "postgres user read does not contain other user data");

  assert(otherLoaded?.walletAddress === otherWalletAddress, "postgres read returns other wallet address");
  assert(otherLoaded?.walletAssetSnapshot?.USDT0 === "0.011", "postgres read returns other USDT0 snapshot");
  assert(
    otherLoaded?.recentMessages.some((message) => message.text.includes(otherUserMarker)),
    "postgres read returns other user message"
  );
  assert(
    otherLoaded?.walletRecords.some((record) => record.id === otherRecordId),
    "postgres read returns other wallet record"
  );
  assert(
    otherLoaded?.verifiedWalletTransfers.some((transfer) => transfer.txHash === otherTxHash),
    "postgres read returns other verified transfer"
  );
  assert(otherLoaded?.knowledgeNotes.some((note) => note.includes(otherUserMarker)), "postgres read returns other knowledge note");
  assert(!sessionContains(otherLoaded, userMarker), "postgres other user read does not contain first user data");
  assert(!missingLoaded, "postgres returns no session for missing user");

  console.log(JSON.stringify({
    ok: true,
    userId,
    otherUserId,
    checks: [
      "dual write completed",
      "dual write completed for other user",
      "postgres read returned wallet",
      "postgres read returned asset snapshot",
      "postgres read returned messages",
      "postgres read returned wallet records",
      "postgres read returned verified transfer",
      "postgres read returned knowledge notes",
      "postgres read returned other wallet",
      "postgres read returned other asset snapshot",
      "postgres read returned other messages",
      "postgres read returned other wallet records",
      "postgres read returned other verified transfer",
      "postgres read returned other knowledge notes",
      "postgres keeps both users isolated",
      "postgres returns no session for missing user"
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

function sessionContains(memory, marker) {
  if (!memory) return false;
  return [
    memory.walletAddress || "",
    JSON.stringify(memory.walletAssetSnapshot || {}),
    JSON.stringify(memory.recentMessages || []),
    JSON.stringify(memory.walletRecords || []),
    JSON.stringify(memory.verifiedWalletTransfers || []),
    JSON.stringify(memory.knowledgeNotes || [])
  ].some((value) => value.includes(marker));
}

function assert(condition, label) {
  if (!condition) throw new Error(`Live HWallet Postgres smoke failed: ${label}`);
}
