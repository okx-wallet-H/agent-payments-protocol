import type { AgentContext, AuditRecord, UserContext } from "../domain/types";

export function createAuditRecord(
  user: UserContext,
  agent: AgentContext,
  input: Omit<AuditRecord, "id" | "agentId" | "userId" | "createdAt">
): AuditRecord {
  return {
    id: crypto.randomUUID(),
    agentId: agent.agentId,
    userId: user.userId,
    createdAt: new Date().toISOString(),
    ...input
  };
}
