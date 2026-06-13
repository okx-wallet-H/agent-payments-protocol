import { PHASE_ONE_APP_SHELL } from "./app-shell";
import { createUserConsolePanel } from "./user-console";
import { createWorldCupInfoPanel } from "./world-cup-info";
import type { MarketSnapshot, MobileHomeView, StrategyCard, TrackingCard } from "../domain/types";
import type { PhaseOneRecord } from "../storage/phase-one-store";

export function createMobileHomeView(input: {
  walletAddress?: `0x${string}`;
  worldCupMarkets: MarketSnapshot[];
  tracking: TrackingCard[];
  strategies: StrategyCard[];
  records: PhaseOneRecord[];
}): MobileHomeView {
  const recentRecords = input.records.slice(0, 8).map((record) => ({
    id: record.id,
    type: record.type,
    title: record.title,
    note: record.note,
    createdAt: record.createdAt
  }));

  return {
    type: "mobile_home_view",
    shell: PHASE_ONE_APP_SHELL,
    panels: {
      topLeft: createWorldCupInfoPanel(input.worldCupMarkets),
      topRight: createUserConsolePanel({
        walletAddress: input.walletAddress
      })
    },
    state: {
      trackingCount: input.tracking.length,
      strategyCount: input.strategies.length,
      recordCount: input.records.length
    },
    quickPrompts: [
      {
        id: "world_cup",
        text: "帮我看看市场机会"
      },
      {
        id: "recharge",
        text: "我要充值"
      },
      {
        id: "records",
        text: "看看我最近让你做了什么"
      }
    ],
    recent: {
      tracking: input.tracking.slice(0, 3),
      strategies: input.strategies.slice(0, 3),
      records: recentRecords
    },
    updatedAt: new Date().toISOString()
  };
}
