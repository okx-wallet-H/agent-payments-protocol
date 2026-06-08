import { confirmExecutionPreview } from "./execution-preview";
import { createPreviewForIntent, executeAgentIntent } from "./agent-execution";
import { summarizeAgentMemory } from "./agent-memory";
import { runPredictionAgent } from "./agent-runner";
import type { Agent, AgentChatAction, AgentDecision, AgentMessage } from "./types";

export interface AgentChatResult {
  messages: AgentMessage[];
  agentPatch: Pick<Agent, "messages" | "runs" | "intents" | "previews" | "executions">;
}

export async function handleAgentChat(agent: Agent, content: string, userId?: string): Promise<AgentChatResult> {
  const userMessage = createMessage(agent.id, "user", content);
  const decision = decideAgentAction(agent, content);

  if (decision.action === "run_agent") {
    const amountOkb = Number(
      decision.toolCalls[0]?.arguments.amountOkb || Math.min(0.01, agent.policy.maxSingleSpendOkb)
    );
    const result = await runPredictionAgent(agent, amountOkb, "World Cup");
    const assistantMessage = createMessage(
      agent.id,
      "assistant",
      result.run.status === "failed"
        ? `我帮你看了一下世界杯相关市场，但暂时没找到适合继续分析的机会。原因：${result.run.selectionReason}`
        : `我帮你看完了：一共扫到 ${result.run.observedMarketCount} 个市场，当前重点关注「${result.run.selectedQuestion}」。我已经生成了一份操作方案，默认先走模拟预览；交易签名由 TEE 可信执行环境处理。`,
      "run_agent",
      {
        runId: result.run.id,
        intentId: result.intent?.id,
        previewId: result.preview?.id,
        status: result.run.status
      },
      decision
    );

    return {
      messages: [userMessage, assistantMessage],
      agentPatch: {
        messages: [assistantMessage, userMessage, ...agent.messages],
        runs: [result.run, ...agent.runs],
        intents: result.intent ? [result.intent, ...agent.intents] : agent.intents,
        previews: result.preview ? [result.preview, ...agent.previews] : agent.previews,
        executions: agent.executions
      }
    };
  }

  if (decision.action === "confirm_preview") {
    const preview = agent.previews[0];
    if (!preview) {
      return staticReply(
        agent,
        userMessage,
        "现在还没有可以确认的方案。你可以先说“帮我看看世界杯机会”，我会先给你一份方案。",
        decision
      );
    }

    try {
      const confirmedPreview = confirmExecutionPreview(preview, extractConfirmationText(content), userId);
      const assistantMessage = createMessage(
        agent.id,
        "assistant",
        getConfirmationReply(confirmedPreview),
        "confirm_preview",
        {
          previewId: confirmedPreview.id,
          confirmationStatus: confirmedPreview.confirmationStatus,
          confirmationAttempts: confirmedPreview.confirmationAttempts
        },
        decision
      );
      return {
        messages: [userMessage, assistantMessage],
        agentPatch: {
          messages: [assistantMessage, userMessage, ...agent.messages],
          runs: agent.runs,
          intents: agent.intents,
          previews: agent.previews.map((item) => (item.id === confirmedPreview.id ? confirmedPreview : item)),
          executions: agent.executions
        }
      };
    } catch (error) {
      return staticReply(
        agent,
        userMessage,
        error instanceof Error ? `确认失败：${error.message}` : "确认失败，请重新输入完整确认语。",
        decision
      );
    }
  }

  if (decision.action === "preview_intent") {
    try {
      const result = createPreviewForIntent(agent);
      const assistantMessage = createMessage(
        agent.id,
        "assistant",
        `方案已经生成：预计使用 ${result.preview.amountOkb} OKB，当前是${result.preview.mode === "paper" ? "安全演练" : "实盘"}模式。${
          result.preview.confirmationCode ? `如果你要确认，请输入 6 位确认码：${result.preview.confirmationCode}` : ""
        }`,
        "preview_intent",
        {
          intentId: result.intent.id,
          previewId: result.preview.id,
          confirmationStatus: result.preview.confirmationStatus
        },
        decision
      );
      return {
        messages: [userMessage, assistantMessage],
        agentPatch: {
          messages: [assistantMessage, userMessage, ...agent.messages],
          runs: agent.runs,
          intents: agent.intents,
          previews: [result.preview, ...agent.previews],
          executions: agent.executions
        }
      };
    } catch {
      return staticReply(agent, userMessage, "现在还没有可生成方案的机会。你可以先说“帮我看看世界杯机会”。", decision);
    }
  }

  if (decision.action === "execute_intent") {
    try {
      const result = executeAgentIntent(agent, undefined, agent.previews[0]?.id);
      const assistantMessage = createMessage(
        agent.id,
        "assistant",
        result.execution.status === "blocked"
          ? `为了保护资金，这次没有继续执行：${result.execution.error}`
          : `已完成${result.execution.status === "simulated" ? "模拟执行" : "执行"}。${result.execution.error || "记录已保存，你可以随时查看。"}`,
        "execute_intent",
        {
          executionId: result.execution.id,
          status: result.execution.status,
          error: result.execution.error
        },
        decision
      );
      return {
        messages: [userMessage, assistantMessage],
        agentPatch: {
          messages: [assistantMessage, userMessage, ...agent.messages],
          runs: agent.runs,
          intents: result.intents,
          previews: agent.previews,
          executions: [result.execution, ...agent.executions]
        }
      };
    } catch {
      return staticReply(agent, userMessage, "现在还没有可执行的方案。你可以先说“帮我看看世界杯机会”。", decision);
    }
  }

  if (decision.action === "status") {
    const run = agent.runs[0];
    const preview = agent.previews[0];
    const reply = [
      `Agent 当前状态：${agent.status}`,
      `资金小账户：${agent.vault?.address || "未创建"}`,
      `最近一次分析：${run ? `${run.status} / ${run.selectedQuestion || run.selectionReason}` : "暂无"}`,
      `最近一份方案：${preview ? `${preview.mode} / ${preview.confirmationStatus}` : "暂无"}`,
      `预算：单笔 ${agent.policy.maxSingleSpendOkb} OKB，日预算 ${agent.policy.dailyBudgetOkb} OKB`
    ].join("\n");
    return staticReply(agent, userMessage, reply, decision);
  }

  if (decision.action === "memory") {
    return staticReply(agent, userMessage, summarizeAgentMemory(agent.memory), decision);
  }

  return staticReply(
    agent,
    userMessage,
    "你可以直接这样说：\n- “帮我看看世界杯有没有机会”\n- “先给我方案”\n- “模拟执行一下”\n- “现在状态怎么样”\n- “你记住了什么”\n我会先给方案、说风险、留记录；交易签名基于 TEE，私钥不离开可信执行环境。",
    decision
  );
}

function staticReply(
  agent: Agent,
  userMessage: AgentMessage,
  content: string,
  decision: AgentDecision
): AgentChatResult {
  const assistantMessage = createMessage(agent.id, "assistant", content, decision.action, undefined, decision);
  return {
    messages: [userMessage, assistantMessage],
    agentPatch: {
      messages: [assistantMessage, userMessage, ...agent.messages],
      runs: agent.runs,
      intents: agent.intents,
      previews: agent.previews,
      executions: agent.executions
    }
  };
}

function createMessage(
  agentId: string,
  role: AgentMessage["role"],
  content: string,
  action?: AgentMessage["action"],
  toolResult?: Record<string, unknown>,
  decision?: AgentDecision
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    agentId,
    role,
    content,
    action,
    decision,
    toolResult,
    createdAt: new Date().toISOString()
  };
}

function getConfirmationReply(preview: { confirmationStatus: string; confirmationAttempts: number; maxConfirmationAttempts: number }): string {
  if (preview.confirmationStatus === "confirmed") {
    return "你已经明确确认了这份方案。注意：当前仍是安全演练模式，不会广播真实交易。";
  }
  if (preview.confirmationStatus === "locked") {
    return "确认码错误次数过多，这份方案已经失效。请让我重新生成一份方案。";
  }
  return `确认码不正确，还可以再试 ${Math.max(0, preview.maxConfirmationAttempts - preview.confirmationAttempts)} 次。`;
}

function decideAgentAction(agent: Agent, content: string): AgentDecision {
  const normalized = content.trim().toLowerCase();
  const memoryAmount = agent.memory?.riskProfile.maxComfortableTradeOkb;
  const amountOkb = parseAmountOkb(normalized) ?? memoryAmount ?? Math.min(0.01, agent.policy.maxSingleSpendOkb);

  if (asksForRun(normalized)) {
    return createDecision(
      agent,
      "run_agent",
      0.82,
      ["User asked the agent to analyze or run a prediction workflow."],
      [{ name: "runPredictionAgent", arguments: { amountOkb, keyword: "World Cup" } }]
    );
  }

  if (asksForConfirmation(normalized)) {
    return createDecision(
      agent,
      "confirm_preview",
      0.9,
      ["User supplied or requested a typed confirmation flow."],
      [
        {
          name: "confirmExecutionPreview",
          arguments: {
            previewId: agent.previews[0]?.id,
            confirmationText: extractConfirmationText(content)
          }
        }
      ]
    );
  }

  if (asksForPreview(normalized)) {
    return createDecision(agent, "preview_intent", 0.86, ["User asked to create or refresh an execution preview."], [
      { name: "createPreviewForIntent", arguments: { intentId: agent.intents[0]?.id } }
    ]);
  }

  if (asksForExecution(normalized)) {
    return createDecision(agent, "execute_intent", 0.78, ["User asked to execute the current intent."], [
      { name: "executeAgentIntent", arguments: { intentId: agent.intents[0]?.id, previewId: agent.previews[0]?.id } }
    ]);
  }

  if (asksForStatus(normalized)) {
    return createDecision(agent, "status", 0.88, ["User asked for current Agent state."], [
      { name: "summarizeAgentStatus", arguments: { agentId: agent.id } }
    ]);
  }

  if (asksForMemory(normalized)) {
    return createDecision(agent, "memory", 0.88, ["User asked what the Agent remembers."], [
      { name: "summarizeAgentMemory", arguments: { agentId: agent.id } }
    ]);
  }

  return createDecision(agent, "help", 0.7, ["No executable onchain intent was detected."], [
    { name: "explainCapabilities", arguments: {} }
  ]);
}

function createDecision(
  agent: Agent,
  action: AgentChatAction,
  confidence: number,
  reasons: string[],
  toolCalls: AgentDecision["toolCalls"]
): AgentDecision {
  return {
    engine: "local-rules",
    action,
    confidence,
    reasons: [
      ...reasons,
      ...(agent.memory?.recentLessons[0] ? [`Memory recalled: ${agent.memory.recentLessons[0]}`] : [])
    ],
    toolCalls,
    safetyNotes: [
      "Transaction signing is TEE-backed; the private key never leaves the trusted execution environment.",
      "The assistant creates policy-scoped execution requests instead of handling private keys.",
      "Every transaction path must pass policy, preview, typed confirmation, and live-mode gates.",
      "Current MVP uses paper/simulated execution unless live mode is explicitly configured.",
      ...(agent.memory?.riskProfile.prefersSmallMainnetBudgets ? ["Memory: user prefers small mainnet budgets."] : [])
    ]
  };
}

function asksForRun(value: string): boolean {
  if (/方案|预览|preview/.test(value)) return false;
  return /运行|开始|分析|预测|机会|看看|帮我看|world cup|世界杯|run/.test(value);
}

function asksForConfirmation(value: string): boolean {
  return /确认|confirm/.test(value) || /\b\d{6}\b/.test(value);
}

function asksForPreview(value: string): boolean {
  return /预览|方案|计划|先看看|preview/.test(value);
}

function asksForExecution(value: string): boolean {
  return /执行|下单|模拟执行|操作一下|试一下|execute|simulate/.test(value);
}

function asksForStatus(value: string): boolean {
  return /状态|进度|status|summary|情况/.test(value);
}

function asksForMemory(value: string): boolean {
  return /记住|记忆|memory|偏好|习惯|你知道我/.test(value);
}

function parseAmountOkb(value: string): number | undefined {
  const match = value.match(/(\d+(?:\.\d+)?)\s*okb/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

function extractConfirmationText(value: string): string {
  const confirmIndex = value.toLowerCase().indexOf("confirm live mode");
  if (confirmIndex >= 0) return value.slice(confirmIndex).trim();
  const code = value.match(/\b\d{6}\b/);
  if (code) return code[0];
  return value.trim();
}
