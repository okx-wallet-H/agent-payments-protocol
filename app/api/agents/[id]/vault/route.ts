import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { jsonError, parseJson } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";
import type { AgentVault, WalletType } from "@/lib/types";
import { syncVaultBalance } from "@/lib/vault-sync";
import { assertEvmAddress, toXkoDisplayAddress } from "@/lib/xlayer";

interface VaultBody {
  address?: string;
  walletType?: WalletType;
  ownerUserId?: string;
  userId?: string;
}

function randomVaultAddress(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);

  const body = await parseJson<VaultBody>(request);
  const access = await checkAgentAccess(agent, request, body);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  const address = body.address || randomVaultAddress();
  assertEvmAddress(address);

  const draftVault: AgentVault = {
    chainId: 196,
    chainName: "X Layer",
    address,
    displayAddress: toXkoDisplayAddress(address),
    walletType: body.walletType || "aa_smart_account",
    balanceSnapshotOkb: "0",
    lastBalanceSyncAt: new Date().toISOString()
  };
  const sync = await syncVaultBalance(draftVault);

  const saved = await saveAgent(
    { ...agent, vault: sync.vault },
    auditEvent(agent.id, "vault.created", "Agent Vault created or linked", {
      address: sync.vault.address,
      walletType: sync.vault.walletType,
      balanceSnapshotOkb: sync.vault.balanceSnapshotOkb,
      balanceSyncOk: sync.ok,
      balanceSyncError: sync.error
    })
  );

  return NextResponse.json({ agent: saved, vault: sync.vault, balanceSync: { ok: sync.ok, error: sync.error } });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  return NextResponse.json({ vault: agent.vault || null });
}
