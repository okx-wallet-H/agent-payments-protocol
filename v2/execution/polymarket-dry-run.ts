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

    return {
      requestId: request.id,
      status: raw?.dry_run ? "dry_run_completed" : "failed",
      summary: raw?.dry_run ? "Dry-run completed." : "Dry-run did not return a successful preview.",
      raw,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      requestId: request.id,
      status: "failed",
      summary: error instanceof Error ? error.message : "Dry-run failed.",
      createdAt: new Date().toISOString()
    };
  }
}
