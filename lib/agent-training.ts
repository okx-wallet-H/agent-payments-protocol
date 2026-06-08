import type { Agent, AgentMessage } from "./types";

export interface AgentTrainingExample {
  id: string;
  agentId: string;
  input: {
    userMessage: string;
    agentStatus: string;
    hasVault: boolean;
    memory: Agent["memory"];
    policy: {
      maxSingleSpendOkb: number;
      dailyBudgetOkb: number;
      allowedMarkets: string[];
      revoked: boolean;
    };
  };
  expected: {
    assistantMessage: string;
    action: string;
    decision: AgentMessage["decision"];
    toolResult?: Record<string, unknown>;
  };
  safety: {
    requiresPolicyCheck: boolean;
    requiresPreview: boolean;
    requiresTypedConfirmation: boolean;
    allowsDirectFundMovement: false;
  };
  createdAt: string;
}

export function buildAgentTrainingExamples(agent: Agent): AgentTrainingExample[] {
  const messages = [...(agent.messages || [])].reverse();
  const examples: AgentTrainingExample[] = [];

  for (let index = 0; index < messages.length - 1; index += 1) {
    const userMessage = messages[index];
    const assistantMessage = messages[index + 1];
    if (userMessage.role !== "user" || assistantMessage.role !== "assistant") continue;

    examples.push({
      id: `${userMessage.id}:${assistantMessage.id}`,
      agentId: agent.id,
      input: {
        userMessage: userMessage.content,
        agentStatus: agent.status,
        hasVault: Boolean(agent.vault),
        memory: agent.memory,
        policy: {
          maxSingleSpendOkb: agent.policy.maxSingleSpendOkb,
          dailyBudgetOkb: agent.policy.dailyBudgetOkb,
          allowedMarkets: agent.policy.allowedMarkets,
          revoked: agent.policy.revoked
        }
      },
      expected: {
        assistantMessage: assistantMessage.content,
        action: assistantMessage.action || "help",
        decision: assistantMessage.decision,
        toolResult: assistantMessage.toolResult
      },
      safety: {
        requiresPolicyCheck: requiresPolicyCheck(assistantMessage.action),
        requiresPreview: requiresPreview(assistantMessage.action),
        requiresTypedConfirmation: requiresTypedConfirmation(assistantMessage.action),
        allowsDirectFundMovement: false
      },
      createdAt: assistantMessage.createdAt
    });
  }

  return examples;
}

export function toJsonl(examples: AgentTrainingExample[]): string {
  return examples.map((example) => JSON.stringify(example)).join("\n");
}

function requiresPolicyCheck(action?: string): boolean {
  return action === "run_agent" || action === "preview_intent" || action === "execute_intent";
}

function requiresPreview(action?: string): boolean {
  return action === "preview_intent" || action === "execute_intent";
}

function requiresTypedConfirmation(action?: string): boolean {
  return action === "confirm_preview" || action === "execute_intent";
}
