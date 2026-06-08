import { NextResponse } from "next/server";
import { createWorldCupExploreSource, createWorldCupExploreView } from "@/v2/app/world-cup-explore";
import { hasOkxOutcomesCredentials, listOkxWorldCupMarkets } from "@/v2/execution/okx-outcomes-client";
import { normalizeOkxOutcomes } from "@/v2/execution/okx-outcomes-output";
import { sampleOkxWorldCupPayload } from "@/v2/execution/okx-world-cup-sample";
import { listWorldCupMarkets } from "@/v2/execution/polymarket-cli";
import type { MarketSnapshot } from "@/v2/domain/types";

export const runtime = "nodejs";

export async function GET() {
  const data = await readMarketsSafely();

  return NextResponse.json({
    explore: createWorldCupExploreView(data.markets, data.source)
  });
}

type ExploreData = {
  markets: MarketSnapshot[];
  source: ReturnType<typeof createWorldCupExploreSource>;
};

async function readMarketsSafely(): Promise<ExploreData> {
  const mode = readDataMode();
  if (mode === "sample") return sampleData();

  if (mode !== "plugin" && hasOkxOutcomesCredentials()) {
    try {
      const okxMarkets = await listOkxWorldCupMarkets();
      if (okxMarkets.length > 0) {
        return {
          markets: okxMarkets,
          source: createWorldCupExploreSource("okx-outcomes", "live")
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

function readDataMode(): "auto" | "live" | "plugin" | "sample" {
  const value = process.env.OKX_OUTCOMES_DATA_MODE?.trim().toLowerCase();
  if (value === "live" || value === "plugin" || value === "sample") return value;
  return "auto";
}
