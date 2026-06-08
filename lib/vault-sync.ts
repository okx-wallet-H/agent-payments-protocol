import { getOkbBalance } from "./xlayer";
import type { AgentVault } from "./types";

export interface VaultBalanceSyncResult {
  vault: AgentVault;
  ok: boolean;
  error?: string;
}

export async function syncVaultBalance(vault: AgentVault): Promise<VaultBalanceSyncResult> {
  try {
    const balanceSnapshotOkb = await getOkbBalance(vault.address);
    return {
      ok: true,
      vault: {
        ...vault,
        balanceSnapshotOkb,
        lastBalanceSyncAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ok: false,
      vault: {
        ...vault,
        lastBalanceSyncAt: new Date().toISOString()
      },
      error: error instanceof Error ? error.message : "Failed to sync X Layer OKB balance"
    };
  }
}
