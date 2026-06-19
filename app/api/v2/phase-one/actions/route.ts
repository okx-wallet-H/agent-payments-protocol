import { NextResponse } from "next/server";
import { createBusinessGoal, createPredictionResearchPlan } from "@/v2/agent/business-agent";
import { createSimulationCard } from "@/v2/agent/simulation-card";
import { createStrategyCard } from "@/v2/agent/strategy-card";
import { createTrackingCard } from "@/v2/agent/tracking-card";
import { createMobileActionTurn } from "@/v2/app/mobile-chat";
import { resolvePhaseOneUser } from "@/v2/auth/request-user";
import { evaluateAgentPolicy, type AgentPolicyAction } from "@/v2/agent/policy";
import type { BusinessGoalType, ConversationCard, MarketSnapshot } from "@/v2/domain/types";
import { createOkxOutcomesDryRunPlan, executeOkxOutcomesDryRunPreview } from "@/v2/execution/okx-outcomes-preview";
import { createPolymarketDryRunPlan, executePolymarketDryRun } from "@/v2/execution/polymarket-dry-run";
import { saveAgentAction, saveAgentRun } from "@/v2/storage/agent-action-store";
import { saveAuditTimelineEvent } from "@/v2/storage/audit-timeline-store";
import {
  findPhaseOneRecordByIdempotencyKey,
  savePhaseOneRecord,
  type PhaseOneEventType
} from "@/v2/storage/phase-one-store";

export const runtime = "nodejs";

interface ActionBody {
  action?: "simulate" | "track" | "build_strategy";
  market?: MarketSnapshot;
  amountUsd?: number;
  userId?: string;
  idempotencyKey?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ActionBody;
  if (!body.action) return NextResponse.json({ error: "action is required" }, { status: 400 });
  if (!body.market) return NextResponse.json({ error: "market is required" }, { status: 400 });
  const user = await resolvePhaseOneUser(request, body);
  if (!user.ok) {
    return NextResponse.json({ error: user.error }, { status: user.status || 401 });
  }
  const idempotencyKey = body.idempotencyKey?.trim() || undefined;
  const policyDecision = evaluateAgentPolicy({
    action: toPolicyAction(body.action),
    market: body.market,
    amountUsd: body.amountUsd
  });
  if (policyDecision.status === "block") {
    await saveActionExecutionRecord({
      userId: user.userId,
      action: body.action,
      status: "blocked",
      market: body.market,
      amountUsd: body.amountUsd,
      idempotencyKey,
      policyDecision
    });
    await saveAuditTimelineEvent({
      userId: user.userId,
      type: "policy.blocked",
      title: "已拦截 Agent 动作",
      note: policyDecision.userText,
      status: "blocked",
      marketId: body.market.marketId,
      marketTitle: body.market.question
    });
    return NextResponse.json({
      error: policyDecision.userText,
      policy: policyDecision.policy,
      decision: policyDecision
    }, { status: 403 });
  }

  if (idempotencyKey) {
    const existing = await findPhaseOneRecordByIdempotencyKey(user.userId, idempotencyKey);
    if (existing) {
      return NextResponse.json({
        card: existing.card,
        record: existing,
        mobileTurn: createActionMobileTurnFromRecord(existing.type, existing.card),
        finalText: getActionFinalText(existing.type),
        idempotent: true
      });
    }
  }

  if (body.action === "track") {
    const card = createTrackingCard(body.market);
    const record = await savePhaseOneRecord({
      type: "tracking.saved",
      userId: user.userId,
      idempotencyKey,
      title: card.title,
      note: card.agentNote,
      card
    });
    await saveAuditTimelineEvent({
      userId: user.userId,
      type: "tracking.saved",
      title: "已加入跟踪",
      note: "Agent 已保存这个市场机会，未发生资金动作。",
      status: "success",
      marketId: body.market.marketId,
      marketTitle: body.market.question,
      recordId: record.id
    });
    await saveActionExecutionRecord({
      userId: user.userId,
      action: body.action,
      status: "completed",
      market: body.market,
      idempotencyKey,
      policyDecision,
      recordId: record.id
    });

    return NextResponse.json({
      card,
      record,
      mobileTurn: createMobileActionTurn({
        userText: "加入跟踪",
        goalType: "prediction_market_research",
        progress: ["我先把这个机会放进跟踪里。", "后面重点看价格和热度变化。"],
        card,
        finalText: "我先帮你盯着，有明显变化再提醒你。",
        suggestedInput: "再帮我看一个机会"
      }),
      finalText: "我先帮你盯着，有明显变化再提醒你。"
    });
  }

  if (body.action === "build_strategy") {
    const card = createStrategyCard(body.market);
    const record = await savePhaseOneRecord({
      type: "strategy.saved",
      userId: user.userId,
      idempotencyKey,
      title: card.title,
      note: card.agentNote,
      card
    });
    await saveAuditTimelineEvent({
      userId: user.userId,
      type: "strategy.saved",
      title: "已生成策略草案",
      note: "Agent 已整理观察和模拟思路，未发生真实下单。",
      status: "success",
      marketId: body.market.marketId,
      marketTitle: body.market.question,
      recordId: record.id
    });
    await saveActionExecutionRecord({
      userId: user.userId,
      action: body.action,
      status: "completed",
      market: body.market,
      idempotencyKey,
      policyDecision,
      recordId: record.id
    });

    return NextResponse.json({
      card,
      record,
      mobileTurn: createMobileActionTurn({
        userText: "生成策略",
        goalType: "prediction_market_research",
        progress: ["我先按小额思路整理。", "重点放在观察、模拟和止损。"],
        card,
        finalText: "策略草案先给你，下一步可以跑模拟。",
        suggestedInput: "先模拟一下"
      }),
      finalText: "策略草案先给你，下一步可以跑模拟。"
    });
  }

  const goal = createBusinessGoal("市场机会");
  const basePlan = createPredictionResearchPlan(goal, body.market);
  const amountUsd = body.amountUsd || 1;
  const result =
    body.market.provider === "okx-outcomes"
      ? executeOkxOutcomesDryRunPreview(
          createOkxOutcomesDryRunPlan({
            basePlan,
            amountUsd,
            limitPrice: body.market.yesPrice
          })
        )
      : await executePolymarketDryRun(
          createPolymarketDryRunPlan({
            basePlan,
            amountUsd,
            limitPrice: body.market.yesPrice
          })
        );
  const card = createSimulationCard(result, body.market);
  const record = await savePhaseOneRecord({
    type: "simulation.saved",
    userId: user.userId,
    idempotencyKey,
    title: card.title,
    note: card.agentNote,
    card
  });
  await saveAuditTimelineEvent({
    userId: user.userId,
    type: "simulation.completed",
    title: result.status === "dry_run_completed" ? "已完成模拟" : "模拟未完成",
    note: "Agent 已完成一次预测模拟，未提交真实订单。",
    status: result.status === "dry_run_completed" ? "success" : "info",
    marketId: body.market.marketId,
    marketTitle: body.market.question,
    recordId: record.id,
    amountLabel: card.amountLabel,
    simulationSide: card.sideLabel,
    simulationShares: card.sharesLabel,
    simulationPrice: card.priceLabel
  });
  await saveActionExecutionRecord({
    userId: user.userId,
    action: body.action,
    status: result.status === "dry_run_completed" ? "completed" : "failed",
    market: body.market,
    amountUsd,
    idempotencyKey,
    policyDecision,
    recordId: record.id,
    output: {
      resultStatus: result.status,
      amountLabel: card.amountLabel,
      sideLabel: card.sideLabel,
      priceLabel: card.priceLabel
    }
  });

  return NextResponse.json({
    card,
    record,
    mobileTurn: createMobileActionTurn({
      userText: "先模拟一下",
      goalType: "prediction_market_dry_run",
      progress: ["我先跑一遍模拟。", "这一步不会提交订单。", "正在整理模拟结果。"],
      card,
      finalText: result.status === "dry_run_completed" ? "模拟完成，可以继续观察。" : "模拟没跑通，我先保留这个机会。",
      suggestedInput: result.status === "dry_run_completed" ? "加入跟踪" : "换一个机会"
    }),
    result,
    finalText: result.status === "dry_run_completed" ? "模拟完成，可以继续观察。" : "模拟没跑通，我先保留这个机会。"
  });
}

async function saveActionExecutionRecord(input: {
  userId: string;
  action: NonNullable<ActionBody["action"]>;
  status: "blocked" | "completed" | "failed";
  market: MarketSnapshot;
  amountUsd?: number;
  idempotencyKey?: string;
  policyDecision: ReturnType<typeof evaluateAgentPolicy>;
  recordId?: string;
  output?: Record<string, unknown>;
}) {
  const finishedAt = new Date().toISOString();
  const run = await saveAgentRun({
    userId: input.userId,
    intent: `phase-one action: ${input.action}`,
    status: input.status === "blocked" ? "blocked" : input.status,
    input: {
      action: input.action,
      marketId: input.market.marketId,
      marketTitle: input.market.question,
      amountUsd: input.amountUsd
    },
    output: {
      recordId: input.recordId,
      moneyMoved: false,
      ...(input.output || {})
    },
    finishedAt
  });
  await saveAgentAction({
    userId: input.userId,
    runId: run.id,
    action: input.action,
    status: input.status,
    capability: {
      source: "phase-one-actions",
      mode: input.action === "simulate" ? "dry_run" : "observe",
      liveExecution: {
        enabled: false,
        reason: "MVP 阶段关闭真实下单"
      }
    },
    policyResult: toJsonObject(input.policyDecision),
    idempotencyKey: input.idempotencyKey ? `phase-one-action:${input.idempotencyKey}` : undefined,
    moneyMoved: false,
    createdAt: finishedAt
  });
}

function toPolicyAction(action: NonNullable<ActionBody["action"]>): AgentPolicyAction {
  if (action === "track") return "track";
  if (action === "build_strategy") return "build_strategy";
  return "simulate";
}

function createActionMobileTurnFromRecord(type: PhaseOneEventType, card: ConversationCard) {
  return createMobileActionTurn({
    userText: getActionUserText(type),
    goalType: getActionGoalType(type),
    progress: getActionProgress(type),
    card,
    finalText: getActionFinalText(type),
    suggestedInput: getActionSuggestedInput(type)
  });
}

function getActionUserText(type: PhaseOneEventType): string {
  if (type === "prediction.saved") return "打开预测";
  if (type === "tracking.saved") return "加入跟踪";
  if (type === "strategy.saved") return "生成策略";
  return "先模拟一下";
}

function getActionGoalType(type: PhaseOneEventType): BusinessGoalType {
  if (type === "simulation.saved") return "prediction_market_dry_run";
  return "prediction_market_research";
}

function getActionProgress(type: PhaseOneEventType): string[] {
  if (type === "prediction.saved") return ["这张预测卡已经生成过。", "我直接把预测卡拿给你。"];
  if (type === "tracking.saved") return ["这个机会已经在跟踪里。", "我直接把之前的结果拿给你。"];
  if (type === "strategy.saved") return ["这份策略已经生成过。", "我直接把策略草案拿给你。"];
  return ["这次模拟已经跑过。", "我直接把模拟结果拿给你。"];
}

function getActionFinalText(type: PhaseOneEventType): string {
  if (type === "prediction.saved") return "预测卡在这里，可以继续跟踪、策略或模拟。";
  if (type === "tracking.saved") return "我先帮你盯着，有明显变化再提醒你。";
  if (type === "strategy.saved") return "策略草案先给你，下一步可以跑模拟。";
  return "模拟完成，可以继续观察。";
}

function getActionSuggestedInput(type: PhaseOneEventType): string {
  if (type === "prediction.saved") return "加入跟踪";
  if (type === "tracking.saved") return "再帮我看一个机会";
  if (type === "strategy.saved") return "先模拟一下";
  return "加入跟踪";
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
