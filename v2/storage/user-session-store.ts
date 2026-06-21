import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentWalletAssetSymbol, AgentWalletRecord } from "../wallet/wallet-orchestrator";
import {
  getHWalletSessionStoreMode,
  loadUserSessionFromPostgres,
  writeUserSessionToPostgres
} from "./hwallet-postgres-session-store";

export interface UserSessionMemory {
  userId: string;
  walletAddress?: `0x${string}`;
  walletChainId: 196;
  walletNetwork: "X Layer";
  walletAssetSnapshot?: {
    USDT0?: string;
    USDT?: string;
    OKB?: string;
  };
  counters: {
    homeLoads: number;
    chatTurns: number;
  };
  recentMessages: Array<{
    role: "user" | "agent";
    text: string;
    createdAt: string;
  }>;
  walletRecords: AgentWalletRecord[];
  verifiedWalletTransfers: UserSessionVerifiedWalletTransfer[];
  knowledgeNotes: string[];
  firstSeenAt: string;
  updatedAt: string;
}

export interface UserSessionVerifiedWalletTransfer {
  txHash: `0x${string}`;
  status: "received" | "not_for_wallet" | "failed" | "not_found" | "unsupported_asset";
  message: string;
  explorerUrl?: string;
  chainId: 196;
  assetSymbol?: AgentWalletAssetSymbol;
  amountLabel?: string;
  tokenAddress?: `0x${string}`;
  verifiedAt: string;
}

export interface UserSessionPatch {
  userId: string;
  walletAddress?: `0x${string}`;
  walletAssetSnapshot?: UserSessionMemory["walletAssetSnapshot"];
  walletRecords?: AgentWalletRecord[];
  verifiedWalletTransfer?: Omit<UserSessionVerifiedWalletTransfer, "verifiedAt"> & {
    verifiedAt?: string;
  };
  homeLoad?: boolean;
  userText?: string;
  agentText?: string;
  knowledgeNotes?: string[];
}

export interface WalletAddressConflict {
  existingWalletAddress: `0x${string}`;
  suppliedWalletAddress: `0x${string}`;
}

export type UserWalletSessionBinding =
  | {
      ok: true;
      memory: UserSessionMemory;
    }
  | {
      ok: false;
      conflict: WalletAddressConflict;
    };

const dataDir = path.join(process.cwd(), ".agent-wallet-data");
const sessionsFile = path.join(dataDir, "user-sessions.jsonl");
const LEGACY_USER_SESSION_ID = "legacy-missing-user";

export async function bindUserWalletSession(input: UserSessionPatch): Promise<UserWalletSessionBinding> {
  const userId = requireUserSessionUserId(input.userId);
  const normalizedInput = { ...input, userId };
  const existingMemory = await loadUserSession(userId);
  const walletConflict = getWalletAddressConflict(existingMemory, normalizedInput.walletAddress);
  if (walletConflict) {
    return {
      ok: false,
      conflict: walletConflict
    };
  }

  return {
    ok: true,
    memory: await rememberUserSession(normalizedInput)
  };
}

export async function rememberUserSession(input: UserSessionPatch): Promise<UserSessionMemory> {
  const userId = requireUserSessionUserId(input.userId);
  const storeMode = getHWalletSessionStoreMode();
  const previous =
    storeMode === "postgres" ? await loadUserSessionFromPostgres(userId) : await loadUserSessionFromJsonl(userId);
  const now = new Date().toISOString();
  const recentMessages = [...(previous?.recentMessages || [])];

  if (input.userText) {
    recentMessages.push({
      role: "user",
      text: input.userText,
      createdAt: now
    });
  }

  if (input.agentText) {
    recentMessages.push({
      role: "agent",
      text: input.agentText,
      createdAt: now
    });
  }

  const next: UserSessionMemory = {
    userId,
    walletAddress: resolveSessionWalletAddress(previous?.walletAddress, input.walletAddress),
    walletChainId: 196,
    walletNetwork: "X Layer",
    walletAssetSnapshot: input.walletAssetSnapshot || previous?.walletAssetSnapshot,
    counters: {
      homeLoads: (previous?.counters.homeLoads || 0) + (input.homeLoad ? 1 : 0),
      chatTurns: (previous?.counters.chatTurns || 0) + (input.userText ? 1 : 0)
    },
    recentMessages: recentMessages.slice(-12),
    walletRecords: mergeWalletRecords(input.walletRecords || [], previous?.walletRecords || []),
    verifiedWalletTransfers: mergeVerifiedWalletTransfers(
      previous?.verifiedWalletTransfers || [],
      input.verifiedWalletTransfer
    ),
    knowledgeNotes: mergeKnowledgeNotes(previous?.knowledgeNotes || [], input.knowledgeNotes || []),
    firstSeenAt: previous?.firstSeenAt || now,
    updatedAt: now
  };

  if (storeMode !== "postgres") {
    await mkdir(dataDir, { recursive: true });
    await appendFile(sessionsFile, `${JSON.stringify(next)}\n`, "utf8");
  }

  if (storeMode !== "jsonl") {
    await writeUserSessionToPostgres(next);
  }

  return next;
}

function requireUserSessionUserId(userId: string | undefined): string {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!normalized) {
    throw new Error("User session userId is required");
  }
  return normalized;
}

export function getWalletAddressConflict(
  memory: Pick<UserSessionMemory, "walletAddress"> | undefined,
  walletAddress?: `0x${string}`
): WalletAddressConflict | undefined {
  if (!memory?.walletAddress || !walletAddress) return undefined;
  if (normalizeWalletAddress(memory.walletAddress) === normalizeWalletAddress(walletAddress)) return undefined;
  return {
    existingWalletAddress: memory.walletAddress,
    suppliedWalletAddress: walletAddress
  };
}

function resolveSessionWalletAddress(
  previousWalletAddress?: `0x${string}`,
  suppliedWalletAddress?: `0x${string}`
): `0x${string}` | undefined {
  if (!previousWalletAddress) return suppliedWalletAddress;
  if (!suppliedWalletAddress) return previousWalletAddress;
  if (normalizeWalletAddress(previousWalletAddress) === normalizeWalletAddress(suppliedWalletAddress)) {
    return suppliedWalletAddress;
  }
  return previousWalletAddress;
}

function normalizeWalletAddress(walletAddress: `0x${string}`): string {
  return walletAddress.toLowerCase();
}

export async function loadUserSession(userId: string): Promise<UserSessionMemory | undefined> {
  if (getHWalletSessionStoreMode() === "postgres") {
    return loadUserSessionFromPostgres(userId);
  }
  return loadUserSessionFromJsonl(userId);
}

async function loadUserSessionFromJsonl(userId: string): Promise<UserSessionMemory | undefined> {
  const sessions = await listUserSessions();
  return sessions
    .filter((session) => session.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export function findVerifiedWalletTransfer(
  memory: Pick<UserSessionMemory, "verifiedWalletTransfers"> | undefined,
  txHash: string
): UserSessionVerifiedWalletTransfer | undefined {
  const normalizedTxHash = normalizeTxHash(txHash);
  if (!normalizedTxHash) return undefined;
  return memory?.verifiedWalletTransfers.find((transfer) => transfer.txHash.toLowerCase() === normalizedTxHash);
}

async function listUserSessions(): Promise<UserSessionMemory[]> {
  const raw = await readFile(sessionsFile, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => withSessionDefaults(JSON.parse(line) as Partial<UserSessionMemory>));
}

function withSessionDefaults(input: Partial<UserSessionMemory>): UserSessionMemory {
  const now = new Date().toISOString();
  return {
    userId: input.userId || LEGACY_USER_SESSION_ID,
    walletAddress: input.walletAddress,
    walletChainId: 196,
    walletNetwork: "X Layer",
    walletAssetSnapshot: input.walletAssetSnapshot,
    counters: {
      homeLoads: input.counters?.homeLoads || 0,
      chatTurns: input.counters?.chatTurns || 0
    },
    recentMessages: Array.isArray(input.recentMessages) ? input.recentMessages.slice(-12) : [],
    walletRecords: Array.isArray(input.walletRecords)
      ? input.walletRecords
          .filter((record): record is AgentWalletRecord => Boolean(record?.id && record?.title))
          .slice(0, 40)
      : [],
    verifiedWalletTransfers: Array.isArray(input.verifiedWalletTransfers)
      ? input.verifiedWalletTransfers
          .filter((transfer): transfer is UserSessionVerifiedWalletTransfer => Boolean(transfer?.txHash))
          .slice(-30)
      : [],
    knowledgeNotes: Array.isArray(input.knowledgeNotes) ? input.knowledgeNotes.slice(-20) : [],
    firstSeenAt: input.firstSeenAt || input.updatedAt || now,
    updatedAt: input.updatedAt || now
  };
}

function mergeKnowledgeNotes(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const merged = [...existing, ...incoming]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return merged.slice(-20);
}

function mergeVerifiedWalletTransfers(
  existing: UserSessionVerifiedWalletTransfer[],
  incoming?: UserSessionPatch["verifiedWalletTransfer"]
): UserSessionVerifiedWalletTransfer[] {
  if (!incoming) return existing.slice(-30);

  const normalizedIncomingTxHash = normalizeTxHash(incoming.txHash);
  if (!normalizedIncomingTxHash) return existing.slice(-30);

  const nextIncoming: UserSessionVerifiedWalletTransfer = {
    ...incoming,
    txHash: normalizedIncomingTxHash as `0x${string}`,
    chainId: 196,
    verifiedAt: incoming.verifiedAt || new Date().toISOString()
  };
  const withoutDuplicate = existing.filter((transfer) => transfer.txHash.toLowerCase() !== normalizedIncomingTxHash);
  return [nextIncoming, ...withoutDuplicate].slice(0, 30);
}

function mergeWalletRecords(incoming: AgentWalletRecord[], existing: AgentWalletRecord[]): AgentWalletRecord[] {
  const byId = new Map<string, AgentWalletRecord>();
  for (const record of [...incoming, ...existing]) {
    if (!record?.id) continue;
    if (!byId.has(record.id)) byId.set(record.id, record);
  }

  return [...byId.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 40);
}

function normalizeTxHash(txHash: string): string | undefined {
  const normalized = txHash.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) return undefined;
  return normalized;
}
