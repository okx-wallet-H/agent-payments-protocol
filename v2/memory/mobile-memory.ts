import type { UserSessionMemory } from "../storage/user-session-store";

export interface MobileAgentMemory {
  type: "mobile_agent_memory";
  userId: string;
  source: "session_memory_v1";
  counters: {
    homeLoads: number;
    chatTurns: number;
  };
  wallet?: {
    address?: `0x${string}`;
    chainId: 196;
    network: "X Layer";
    assetSnapshot?: UserSessionMemory["walletAssetSnapshot"];
    records: UserSessionMemory["walletRecords"];
    verifiedTransfers: UserSessionMemory["verifiedWalletTransfers"];
  };
  recentMessages: UserSessionMemory["recentMessages"];
  knowledgeNotes: string[];
  updatedAt?: string;
}

export function createMobileAgentMemory(input: {
  userId: string;
  memory?: UserSessionMemory;
}): MobileAgentMemory {
  return {
    type: "mobile_agent_memory",
    userId: input.userId,
    source: "session_memory_v1",
    counters: {
      homeLoads: input.memory?.counters.homeLoads || 0,
      chatTurns: input.memory?.counters.chatTurns || 0
    },
    wallet: input.memory
      ? {
          address: input.memory.walletAddress,
          chainId: input.memory.walletChainId,
          network: input.memory.walletNetwork,
          assetSnapshot: input.memory.walletAssetSnapshot,
          records: input.memory.walletRecords,
          verifiedTransfers: input.memory.verifiedWalletTransfers
        }
      : undefined,
    recentMessages: input.memory?.recentMessages || [],
    knowledgeNotes: input.memory?.knowledgeNotes || [],
    updatedAt: input.memory?.updatedAt
  };
}
