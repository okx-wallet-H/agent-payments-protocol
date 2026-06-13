import { NextResponse } from "next/server";
import {
  createWorldCupExploreSource,
  createWorldCupExploreView,
  inferWorldCupCategory,
  type WorldCupExploreCategory
} from "@/v2/app/world-cup-explore";
import { hasOkxOutcomesCredentials, listOkxWorldCupMarkets } from "@/v2/execution/okx-outcomes-client";
import { normalizeOkxOutcomes } from "@/v2/execution/okx-outcomes-output";
import { sampleOkxWorldCupPayload } from "@/v2/execution/okx-world-cup-sample";
import { listWorldCupMarkets } from "@/v2/execution/polymarket-cli";
import { captureMarketSnapshots } from "@/v2/storage/market-snapshot-store";
import type { MarketSnapshot } from "@/v2/domain/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const data = await readMarketsSafely(readDataMode(request));
  await captureMarketSnapshotsSafely(data);

  return NextResponse.json({
    explore: createWorldCupExploreView(data.markets, data.source)
  });
}

type ExploreData = {
  markets: MarketSnapshot[];
  source: ReturnType<typeof createWorldCupExploreSource>;
};

async function readMarketsSafely(mode: ReturnType<typeof readDataMode>): Promise<ExploreData> {
  if (mode === "sample") return sampleData();

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
            supplemented ? "OKX 实时数据已同步；暂缺的赛事分类先用样例补齐，方便页面完整演示。" : undefined
          )
        };
      }
    } catch (error) {
      console.warn("OKX Outcomes world cup read failed; falling back to local/plugin data.", error);
      if (mode === "live") {
        return sampleData("OKX 数据暂时不可用，先展示赛事样例。");
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
      console.warn("World cup plugin read failed; falling back to sample data.", error);
    }
  }

  return sampleData();
}

function sampleData(warning?: string): ExploreData {
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

function readDataMode(request: Request): "auto" | "live" | "plugin" | "sample" {
  const url = new URL(request.url);
  const value = (url.searchParams.get("mode") || process.env.OKX_OUTCOMES_DATA_MODE || "").trim().toLowerCase();
  if (value === "live" || value === "plugin" || value === "sample") return value;
  return "auto";
}

async function captureMarketSnapshotsSafely(data: ExploreData): Promise<void> {
  try {
    await captureMarketSnapshots({
      sourceProvider: data.source.provider,
      markets: data.markets
    });
  } catch (error) {
    console.warn("World cup market snapshot capture failed; returning live view without snapshot.", error);
  }
}
