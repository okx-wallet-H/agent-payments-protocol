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
const walletAddress = `0x${"1".repeat(40)}`;
const txHash = `0x${randomBytes(32).toString("hex")}`;
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
        id: "live-smoke-wallet-record",
        title: "测试到账记录",
        note: "live smoke mirror write",
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
    userText: "测试 HWallet 数据库写入",
    agentText: "已记录到 HWallet",
    knowledgeNotes: ["live smoke knowledge note"]
  });

  assert(written.walletAddress === walletAddress, "dual write returns wallet address");
  assert(written.verifiedWalletTransfers[0]?.txHash === txHash, "dual write remembers tx hash");

  process.env.HWALLET_SESSION_STORE = "postgres";
  const loaded = await loadUserSession(userId);

  assert(loaded?.walletAddress === walletAddress, "postgres read returns wallet address");
  assert(loaded?.walletAssetSnapshot?.USDT0 === "0.005", "postgres read returns USDT0 snapshot");
  assert(loaded?.recentMessages.some((message) => message.text.includes("HWallet 数据库写入")), "postgres read returns user message");
  assert(loaded?.walletRecords.some((record) => record.id === "live-smoke-wallet-record"), "postgres read returns wallet record");
  assert(loaded?.verifiedWalletTransfers.some((transfer) => transfer.txHash === txHash), "postgres read returns verified transfer");
  assert(loaded?.knowledgeNotes.includes("live smoke knowledge note"), "postgres read returns knowledge note");

  console.log(JSON.stringify({
    ok: true,
    userId,
    checks: [
      "dual write completed",
      "postgres read returned wallet",
      "postgres read returned asset snapshot",
      "postgres read returned messages",
      "postgres read returned wallet records",
      "postgres read returned verified transfer",
      "postgres read returned knowledge notes"
    ]
  }, null, 2));
} finally {
  await pool.query("delete from app_users where id = $1", [userId]).catch(() => undefined);
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
  if (!condition) throw new Error(`Live HWallet Postgres smoke failed: ${label}`);
}
