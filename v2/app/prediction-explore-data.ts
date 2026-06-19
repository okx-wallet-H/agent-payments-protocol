import {
  createWorldCupExploreSource,
  inferWorldCupCategory,
  type WorldCupExploreCategory
} from "./world-cup-explore";
import { hasOkxOutcomesCredentials, listOkxWorldCupMarkets } from "../execution/okx-outcomes-client";
import { normalizeOkxOutcomes } from "../execution/okx-outcomes-output";
import { sampleOkxWorldCupPayload } from "../execution/okx-world-cup-sample";
import { listWorldCupMarkets } from "../execution/polymarket-cli";
import { captureMarketSnapshots } from "../storage/market-snapshot-store";
import type { MarketSnapshot } from "../domain/types";

export type PredictionExploreMode = "auto" | "live" | "plugin" | "sample";

export type PredictionExploreData = {
  markets: MarketSnapshot[];
  source: ReturnType<typeof createWorldCupExploreSource>;
};

export async function readPredictionExploreData(mode: PredictionExploreMode): Promise<PredictionExploreData> {
  if (mode === "sample") return samplePredictionExploreData();

  if (mode !== "plugin" && hasOkxOutcomesCredentials()) {
    try {
      const okxMarkets = await listOkxWorldCupMarkets();
      if (okxMarkets.length > 0) {
        const augmented = withSampleMarketsForMissingCategories(okxMarkets);
        const supplemented = augmented.length > okxMarkets.length;
        return {
          markets: augmented,
          source: createWorldCupExploreSource(
            "okx-outcomes",
            "live",
            supplemented ? "OKX 实时数据已同步；暂缺的预测分类先用样例补齐，方便页面完整演示。" : undefined
          )
        };
      }
    } catch (error) {
      console.warn("OKX Outcomes prediction explore read failed; falling back to local/plugin data.", error);
      if (mode === "live") {
        return samplePredictionExploreData("OKX 数据暂时不可用，先展示市场样例。");
      }
    }
  }

  if (mode !== "live") {
    try {
      const pluginMarkets = await listWorldCupMarkets(20);
      if (pluginMarkets.length > 0) {
        return {
          markets: pluginMarkets,
          source: createWorldCupExploreSource("polymarket-plugin", "fallback")
        };
      }
    } catch (error) {
      console.warn("Prediction market plugin read failed; falling back to sample data.", error);
    }
  }

  if (mode === "live") {
    return samplePredictionExploreData("OKX 数据暂时不可用，先展示市场样例。");
  }

  return samplePredictionExploreData();
}

export function readPredictionExploreMode(request: Request): PredictionExploreMode {
  const url = new URL(request.url);
  const value = (url.searchParams.get("mode") || process.env.OKX_OUTCOMES_DATA_MODE || "").trim().toLowerCase();
  if (value === "live" || value === "plugin" || value === "sample") return value;
  return "auto";
}

export async function capturePredictionMarketSnapshotsSafely(data: PredictionExploreData): Promise<void> {
  try {
    await captureMarketSnapshots({
      sourceProvider: data.source.provider,
      markets: data.markets
    });
  } catch (error) {
    console.warn("Prediction market snapshot capture failed; returning live view without snapshot.", error);
  }
}

function samplePredictionExploreData(warning?: string): PredictionExploreData {
  return {
    markets: normalizeOkxOutcomes(sampleOkxWorldCupPayload).markets,
    source: createWorldCupExploreSource("local-sample", "sample", warning)
  };
}

function withSampleMarketsForMissingCategories(markets: MarketSnapshot[]): MarketSnapshot[] {
  const required: WorldCupExploreCategory[] = ["champion", "golden_boot", "group_stage", "upcoming_matches"];
  const categories = new Set(markets.map(inferWorldCupCategory));
  const missing = required.filter((category) => !categories.has(category));
  if (missing.length === 0) return markets;

  const seenMarketIds = new Set(markets.map((market) => market.marketId));
  const sampleMarkets = normalizeOkxOutcomes(sampleOkxWorldCupPayload).markets.filter((market) => {
    return missing.includes(inferWorldCupCategory(market)) && !seenMarketIds.has(market.marketId);
  });

  return [...markets, ...sampleMarkets];
}
