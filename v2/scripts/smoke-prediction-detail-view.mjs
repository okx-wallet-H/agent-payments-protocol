import assert from "node:assert/strict";
import { createPredictionDetailView } from "../app/prediction-detail-view.ts";

const market = {
  provider: "okx-outcomes",
  chainId: 196,
  eventId: "event-worldcup",
  marketId: "worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  status: "active",
  marketType: "binary",
  yesAssetId: "yes-asset-very-long-identifier-0001",
  noAssetId: "no-asset-very-long-identifier-0002",
  yesPrice: 0.17,
  noPrice: 0.83,
  acceptingOrders: true,
  liquidity: 4_200_000,
  volume24h: 680_000,
  volume: 12_500_000,
  raw: {
    ignored: "raw provider payload should not be exposed by the detail view"
  }
};

const detail = createPredictionDetailView({
  marketId: market.marketId,
  market,
  yesTicker: {
    instId: market.yesAssetId,
    last: 0.18,
    bid: 0.17,
    ask: 0.19,
    volume24h: 320_000,
    timestamp: "2026-06-18T00:00:00.000Z",
    raw: {}
  },
  noTicker: {
    instId: market.noAssetId,
    last: 0.82,
    bid: 0.81,
    ask: 0.83,
    volume24h: 360_000,
    timestamp: "2026-06-18T00:00:00.000Z",
    raw: {}
  },
  yesCandles: [
    {
      instId: market.yesAssetId,
      timestamp: "2026-06-18T00:00:00.000Z",
      close: 0.16,
      raw: {}
    },
    {
      instId: market.yesAssetId,
      timestamp: "2026-06-18T01:00:00.000Z",
      close: 0.18,
      raw: {}
    }
  ],
  noCandles: [
    {
      instId: market.noAssetId,
      timestamp: "2026-06-18T00:00:00.000Z",
      close: 0.84,
      raw: {}
    },
    {
      instId: market.noAssetId,
      timestamp: "2026-06-18T01:00:00.000Z",
      close: 0.82,
      raw: {}
    }
  ],
  yesOrderBook: {
    instId: market.yesAssetId,
    bids: [{ price: 0.17, size: 120 }],
    asks: [{ price: 0.19, size: 90 }],
    timestamp: "2026-06-18T00:00:00.000Z",
    raw: {}
  },
  noOrderBook: {
    instId: market.noAssetId,
    bids: [{ price: 0.81, size: 80 }],
    asks: [{ price: 0.83, size: 110 }],
    timestamp: "2026-06-18T00:00:00.000Z",
    raw: {}
  }
});

const checks = [];
function check(condition, message) {
  assert(condition, message);
  checks.push(message);
}

check(detail.type === "prediction_detail_view", "detail view has stable type");
check(detail.providerLabel === "OKX Outcomes", "detail view names OKX Outcomes provider");
check(detail.title === market.question, "detail view keeps market title");
check(detail.readOnly === true, "detail view is explicitly read-only");
check(detail.liveExecutionClosed === true, "detail view keeps live execution closed");
check(detail.marketRef.marketId === market.marketId, "detail view exposes market reference");
check(detail.marketRef.chainId === 196, "detail view exposes X Layer chain id");
check(!("raw" in detail.marketRef), "detail view does not expose raw provider payload");

const yes = detail.outcomes.find((outcome) => outcome.side === "yes");
const no = detail.outcomes.find((outcome) => outcome.side === "no");
check(yes?.label === "会", "detail view has yes row");
check(no?.label === "不会", "detail view has no row");
check(yes?.priceLabel === "18¢", "detail view prefers live yes ticker price");
check(no?.priceLabel === "82¢", "detail view prefers live no ticker price");
check(yes?.bidLabel === "17¢", "detail view formats yes bid");
check(no?.askLabel === "83¢", "detail view formats no ask");
check(yes?.assetIdLabel === "yes-as...0001", "detail view redacts yes asset id");
check(no?.assetIdLabel === "no-ass...0002", "detail view redacts no asset id");

check(detail.metrics.liquidityLabel === "4.2M", "detail view formats liquidity");
check(detail.metrics.volume24hLabel === "680K", "detail view formats 24h volume");
check(detail.metrics.volumeLabel === "12.5M", "detail view formats total volume");
check(detail.metrics.statusLabel === "可观察", "detail view uses read-only status label");

const yesBook = detail.orderBook?.find((row) => row.side === "yes");
const noBook = detail.orderBook?.find((row) => row.side === "no");
check(yesBook?.bestBidLabel === "17¢", "detail view summarizes yes order book bid");
check(yesBook?.bestAskLabel === "19¢", "detail view summarizes yes order book ask");
check(noBook?.spreadLabel === "2¢", "detail view summarizes no order book spread");
check(yesBook?.depthLabel === "2 档", "detail view summarizes order book depth");

const yesTrend = detail.trend?.find((row) => row.side === "yes");
const noTrend = detail.trend?.find((row) => row.side === "no");
check(yesTrend?.directionLabel === "升温", "detail view summarizes yes candle trend");
check(yesTrend?.changeLabel === "+2¢", "detail view formats yes trend change");
check(yesTrend?.latestLabel === "18¢", "detail view formats latest yes trend price");
check(yesTrend?.windowLabel === "近 2 根", "detail view summarizes candle window");
check(noTrend?.directionLabel === "降温", "detail view summarizes no candle trend");
check(noTrend?.changeLabel === "-2¢", "detail view formats no trend change");

check(
  detail.actions.map((action) => action.id).join(",") === "observe,simulate,track,build_strategy,order_closed",
  "detail actions expose observe, simulate, track, strategy, and closed order placeholder"
);
check(detail.actions.every((action) => action.disabledLiveExecution === true), "all detail actions disable live execution");
check(detail.actions.every((action) => action.kind !== "read_only" || action.id === "observe"), "observe action is read-only");
check(detail.actions.every((action) => action.kind !== "dry_run" || action.id === "simulate"), "simulate action is dry-run");
check(detail.actions.some((action) => action.id === "track" && action.kind === "local_record" && action.enabled === true), "track action is local-record only");
check(detail.actions.some((action) => action.id === "build_strategy" && action.kind === "local_record" && action.enabled === true), "strategy action is local-record only");
check(detail.actions.some((action) => action.id === "order_closed" && action.kind === "closed" && action.enabled === false), "order placeholder is disabled");
check(detail.actions.some((action) => action.id === "order_closed" && /不开放真实下单/.test(action.disabledReason || "")), "order placeholder explains closed execution");
check(/不会下单、签名或广播交易/.test(detail.insight), "detail insight states no order/sign/broadcast");

const serialized = JSON.stringify(detail);
for (const forbidden of ["buy", "sell", "swap", "broadcast", "place_order", "signature", "privateKey"]) {
  check(!serialized.includes(forbidden), `detail view does not expose forbidden token: ${forbidden}`);
}
check(!serialized.includes(market.yesAssetId), "detail view does not expose full yes asset id");
check(!serialized.includes(market.noAssetId), "detail view does not expose full no asset id");
check(!serialized.includes("raw provider payload"), "detail view does not expose raw provider payload text");
check(!serialized.includes("yesCandles"), "detail view does not expose raw yes candles array");
check(!serialized.includes("noCandles"), "detail view does not expose raw no candles array");

console.log(
  JSON.stringify(
    {
      ok: true,
      checks,
      detail: {
        type: detail.type,
        providerLabel: detail.providerLabel,
        title: detail.title,
        outcomes: detail.outcomes.map((outcome) => ({
          side: outcome.side,
          priceLabel: outcome.priceLabel,
          assetIdLabel: outcome.assetIdLabel
        })),
        trend: detail.trend,
        actions: detail.actions.map((action) => action.id),
        liveExecutionClosed: detail.liveExecutionClosed
      }
    },
    null,
    2
  )
);
