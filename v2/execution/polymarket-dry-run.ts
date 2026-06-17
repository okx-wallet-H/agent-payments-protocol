import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BusinessPlan, ExecutionRequest, ExecutionResult } from "../domain/types";
import { buildPolymarketExecutionRequest } from "./onchainos-polymarket";

const execFileAsync = promisify(execFile);

export function createPolymarketDryRunPlan(input: {
  basePlan: BusinessPlan;
  amountUsd: number;
  limitPrice?: number;
}): BusinessPlan {
  if (!input.basePlan.market) throw new Error("Dry-run requires a market.");

  return {
    ...input.basePlan,
    id: crypto.randomUUID(),
    mode: "dry_run",
    side: "yes",
    amountUsd: input.amountUsd,
    limitPrice: input.limitPrice ?? input.basePlan.market.yesPrice,
    summary: `Dry-run YES on ${input.basePlan.market.question} for $${input.amountUsd}.`,
    createdAt: new Date().toISOString()
  };
}

export function buildDryRunCommand(request: ExecutionRequest): string[] {
  if (request.command !== "polymarket-plugin buy") {
    throw new Error(`Unsupported dry-run command: ${request.command}`);
  }

  const args = [
    "buy",
    "--market-id",
    String(request.args.marketId),
    "--outcome",
    String(request.args.outcome),
    "--amount",
    String(request.args.amount),
    "--order-type",
    String(request.args.orderType || "GTC"),
    "--dry-run"
  ];

  if (request.args.price !== undefined) {
    args.push("--price", String(request.args.price));
  }

  return args;
}

export async function executePolymarketDryRun(plan: BusinessPlan): Promise<ExecutionResult> {
  const request = buildPolymarketExecutionRequest(plan);
  const args = buildDryRunCommand(request);

  try {
    const { stdout, stderr } = await execFileAsync("polymarket-plugin", args, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    });
    const jsonLine = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .at(-1);
    const raw = jsonLine ? JSON.parse(jsonLine) : { stdout, stderr };

    if (raw?.dry_run) {
      return {
        requestId: request.id,
        status: "dry_run_completed",
        summary: "Dry-run completed.",
        raw,
        createdAt: new Date().toISOString()
      };
    }

    return createLocalDryRunPreview(plan, request.id, "Dry-run plugin did not return a successful preview.");
  } catch (error) {
    return createLocalDryRunPreview(
      plan,
      request.id,
      error instanceof Error ? error.message : "Dry-run plugin unavailable."
    );
  }
}

function createLocalDryRunPreview(plan: BusinessPlan, requestId = crypto.randomUUID(), reason = "Local dry-run preview."): ExecutionResult {
  const amount = plan.amountUsd || 1;
  const price = plan.limitPrice || plan.market?.yesPrice || 0.5;
  const shares = price > 0 ? Number((amount / price).toFixed(4)) : undefined;

  return {
    requestId,
    status: "dry_run_completed",
    summary: "Local dry-run preview completed without submitting an order.",
    raw: {
      dry_run: true,
      ok: true,
      local_preview: true,
      reason,
      data: {
        note: "本地安全模拟，未提交订单。",
        usdc_requested: amount,
        shares,
        limit_price: price,
        outcome: plan.side || "yes",
        market: plan.market?.question
      }
    },
    createdAt: new Date().toISOString()
  };
}
