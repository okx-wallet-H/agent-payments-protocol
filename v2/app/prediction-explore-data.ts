import {
  createWorldCupExploreSource
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

  const credentialsBound = hasOkxOutcomesCredentials();

  if (mode !== "plugin" && credentialsBound) {
    try {
      const okxMarkets = await listOkxWorldCupMarkets();
      if (okxMarkets.length > 0) {
        return {
          markets: okxMarkets,
          source: createWorldCupExploreSource("okx-outcomes", "live")
        };
      }
    } catch (error) {
      console.warn("OKX Outcomes prediction explore read failed; returning unavailable live data.", error);
      if (mode === "live") {
        return unavailablePredictionExploreData("OKX 数据暂时不可用，请稍后刷新。", credentialsBound);
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
      console.warn("Prediction market plugin read failed; returning unavailable market data.", error);
    }
  }

  return unavailablePredictionExploreData(
    credentialsBound ? "暂时没有拿到真实预测市场数据，请稍后刷新。" : "OKX Outcomes 读取凭据未配置，暂时不展示样例行情。",
    credentialsBound
  );
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

function unavailablePredictionExploreData(warning: string, credentialsBound: boolean): PredictionExploreData {
  const source = createWorldCupExploreSource("okx-outcomes", "unavailable", warning);
  return {
    markets: [],
    source: {
      ...source,
      providerStatus: credentialsBound ? "unavailable" : "not_configured",
      credentialsBound
    }
  };
}
