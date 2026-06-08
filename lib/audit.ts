import type { AuditEvent } from "./types";

export function auditEvent(
  agentId: string,
  type: AuditEvent["type"],
  message: string,
  metadata: Record<string, unknown> = {}
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    agentId,
    type,
    message,
    metadata,
    createdAt: new Date().toISOString()
  };
}
