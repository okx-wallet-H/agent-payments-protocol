import type { InternalFundPreparation } from "../domain/types";

export function planPredictionStrategyFunds(input: {
  sourceAddress: `0x${string}`;
  requestedAmountUsd?: number;
}): InternalFundPreparation {
  return {
    id: crypto.randomUUID(),
    sourceAddress: input.sourceAddress,
    targetUse: "prediction_strategy",
    requiredNetwork: "Polygon",
    requiredAsset: "USDC.e",
    requestedAmountUsd: input.requestedAmountUsd,
    status: "planned",
    userVisible: false,
    createdAt: new Date().toISOString()
  };
}
