export function getAgentBrainInfo() {
  const llmConfigured = Boolean(process.env.AGENT_BRAIN_PROVIDER && process.env.AGENT_BRAIN_PROVIDER !== "local-rules");

  return {
    provider: llmConfigured ? process.env.AGENT_BRAIN_PROVIDER : "local-rules",
    mode: llmConfigured ? "llm-ready" : "local-deterministic",
    model: process.env.AGENT_BRAIN_MODEL || null,
    tools: [
      "runPredictionAgent",
      "createPreviewForIntent",
      "confirmExecutionPreview",
      "executeAgentIntent",
      "summarizeAgentMemory",
      "summarizeAgentStatus",
      "explainCapabilities"
    ],
    safety: [
      "No direct fund movement from chat",
      "Policy checks before intent execution",
      "Fresh execution preview required",
      "Typed confirmation required for live writes",
      "Paper mode by default"
    ]
  };
}
