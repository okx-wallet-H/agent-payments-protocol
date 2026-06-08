import { NextResponse } from "next/server";
import { checkAgentAccess } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { jsonError } from "@/lib/http";
import { getAgent, saveAgent } from "@/lib/store";
import { syncVaultBalance } from "@/lib/vault-sync";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await getAgent(id);
  if (!agent) return jsonError("Agent not found", 404);
  const access = await checkAgentAccess(agent, request);
  if (!access.ok) return jsonError(access.error || "Forbidden", access.status || 403);
  if (!agent.vault) return jsonError("Agent vault is not configured", 409);

  const sync = await syncVaultBalance(agent.vault);
  const saved = await saveAgent(
    { ...agent, vault: sync.vault },
    auditEvent(agent.id, "vault.balance.synced", sync.ok ? "Agent Vault balance synced" : "Agent Vault balance sync failed", {
      address: sync.vault.address,
      balanceSnapshotOkb: sync.vault.balanceSnapshotOkb,
      balanceSyncOk: sync.ok,
      balanceSyncError: sync.error
    })
  );

  return NextResponse.json(
    {
      agent: saved,
      vault: sync.vault,
      balanceSync: {
        ok: sync.ok,
        error: sync.error
      }
    },
    { status: sync.ok ? 200 : 207 }
  );
}
