import type { MarketSnapshot } from "../domain/types";
import type {
  OkxOutcomeCandle,
  OkxOutcomeMarketData,
  OkxOutcomeOrderBook,
  OkxOutcomeTicker
} from "../execution/okx-outcomes-client";

export type PredictionDetailActionId = "observe" | "simulate" | "track" | "build_strategy" | "order_closed";
export type PredictionDetailActionKind = "read_only" | "dry_run" | "local_record" | "closed";
export type PredictionDetailOutcomeSide = "yes" | "no";

export interface PredictionDetailOutcomeRow {
  side: PredictionDetailOutcomeSide;
  label: "会" | "不会";
  price?: number;
  priceLabel?: string;
  bidLabel?: string;
  askLabel?: string;
  volume24hLabel?: string;
  assetIdLabel?: string;
}

export interface PredictionDetailOrderBookSide {
  side: PredictionDetailOutcomeSide;
  bestBidLabel?: string;
  bestAskLabel?: string;
  spreadLabel?: string;
  depthLabel?: string;
}

export interface PredictionDetailTrendSummary {
  side: PredictionDetailOutcomeSide;
  label: "会" | "不会";
  direction: "up" | "down" | "flat";
  directionLabel: string;
  changeLabel: string;
  latestLabel?: string;
  windowLabel: string;
}

export interface PredictionDetailView {
  type: "prediction_detail_view";
  title: string;
  providerLabel: string;
  readOnly: true;
  liveExecutionClosed: true;
  marketRef: {
    provider: MarketSnapshot["provider"];
    chainId: MarketSnapshot["chainId"];
    marketId: string;
    eventId?: string;
    status?: string;
    acceptingOrders: boolean;
  };
  outcomes: PredictionDetailOutcomeRow[];
  metrics: {
    liquidityLabel?: string;
    volume24hLabel?: string;
    volumeLabel?: string;
    statusLabel: string;
  };
  orderBook?: PredictionDetailOrderBookSide[];
  trend?: PredictionDetailTrendSummary[];
  insight: string;
  actions: Array<{
    id: PredictionDetailActionId;
    label: string;
    kind: PredictionDetailActionKind;
    enabled: boolean;
    disabledLiveExecution: true;
    disabledReason?: string;
  }>;
  updatedAt: string;
}

export function createPredictionDetailView(input: MarketSnapshot | OkxOutcomeMarketData): PredictionDetailView {
  const marketData = isOkxOutcomeMarketData(input) ? input : undefined;
  const market = marketData?.market || (input as MarketSnapshot);

  const outcomes: PredictionDetailOutcomeRow[] = [
    createOutcomeRow("yes", market, marketData?.yesTicker),
    createOutcomeRow("no", market, marketData?.noTicker)
  ];
  const orderBook = createOrderBookSummary(marketData);
  const trend = createTrendSummary(marketData);

  return {
    type: "prediction_detail_view",
    title: market.question,
    providerLabel: providerLabel(market.provider),
    readOnly: true,
    liveExecutionClosed: true,
    marketRef: {
      provider: market.provider,
      chainId: market.chainId,
      marketId: market.marketId,
      eventId: market.eventId,
      status: market.status,
      acceptingOrders: market.acceptingOrders
    },
    outcomes,
    metrics: {
      liquidityLabel: formatAmount(market.liquidity),
      volume24hLabel: formatAmount(market.volume24h),
      volumeLabel: formatAmount(market.volume),
      statusLabel: market.acceptingOrders ? "可观察" : "仅观察"
    },
    orderBook,
    trend,
    insight: createReadOnlyInsight(market, outcomes),
    actions: createDetailActions(),
    updatedAt: new Date().toISOString()
  };
}

function createTrendSummary(marketData?: OkxOutcomeMarketData): PredictionDetailTrendSummary[] | undefined {
  if (!marketData) return undefined;
  const rows = [
    summarizeTrendSide("yes", marketData.yesCandles),
    summarizeTrendSide("no", marketData.noCandles)
  ].filter(isDefined);

  return rows.length > 0 ? rows : undefined;
}

function summarizeTrendSide(
  side: PredictionDetailOutcomeSide,
  candles?: OkxOutcomeCandle[]
): PredictionDetailTrendSummary | undefined {
  const points = normalizeTrendPoints(candles);
  if (points.length < 2) return undefined;

  const first = points[0];
  const last = points[points.length - 1];
  const change = last.close - first.close;
  const direction = change > 0.002 ? "up" : change < -0.002 ? "down" : "flat";
  const directionLabel = direction === "up" ? "升温" : direction === "down" ? "降温" : "横盘";

  return {
    side,
    label: side === "yes" ? "会" : "不会",
    direction,
    directionLabel,
    changeLabel: formatPriceChange(change),
    latestLabel: formatPrice(last.close),
    windowLabel: `近 ${points.length} 根`
  };
}

function normalizeTrendPoints(candles?: OkxOutcomeCandle[]): Array<{ timestamp: string; close: number; index: number }> {
  if (!candles?.length) return [];
  return candles
    .map((candle, index) => {
      if (candle.close === undefined || !Number.isFinite(candle.close)) return undefined;
      return {
        timestamp: candle.timestamp,
        close: candle.close,
        index
      };
    })
    .filter(isDefined)
    .sort((a, b) => {
      const aTime = Date.parse(a.timestamp);
      const bTime = Date.parse(b.timestamp);
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
      return a.index - b.index;
    });
}

function createDetailActions(): PredictionDetailView["actions"] {
  return [
    {
      id: "observe",
      label: "让 Agent 观察",
      kind: "read_only",
      enabled: true,
      disabledLiveExecution: true
    },
    {
      id: "simulate",
      label: "模拟预览",
      kind: "dry_run",
      enabled: true,
      disabledLiveExecution: true
    },
    {
      id: "track",
      label: "加入跟踪",
      kind: "local_record",
      enabled: true,
      disabledLiveExecution: true
    },
    {
      id: "build_strategy",
      label: "生成策略",
      kind: "local_record",
      enabled: true,
      disabledLiveExecution: true
    },
    {
      id: "order_closed",
      label: "下单未开放",
      kind: "closed",
      enabled: false,
      disabledLiveExecution: true,
      disabledReason: "第二阶段不开放真实下单、签名或广播。"
    }
  ];
}

function createOutcomeRow(
  side: PredictionDetailOutcomeSide,
  market: MarketSnapshot,
  ticker?: OkxOutcomeTicker
): PredictionDetailOutcomeRow {
  const price = ticker?.last ?? (side === "yes" ? market.yesPrice : market.noPrice);
  const assetId = side === "yes" ? market.yesAssetId : market.noAssetId;

  return {
    side,
    label: side === "yes" ? "会" : "不会",
    price,
    priceLabel: formatPrice(price),
    bidLabel: formatPrice(ticker?.bid),
    askLabel: formatPrice(ticker?.ask),
    volume24hLabel: formatAmount(ticker?.volume24h),
    assetIdLabel: assetId ? shortenId(assetId) : undefined
  };
}

function createOrderBookSummary(marketData?: OkxOutcomeMarketData): PredictionDetailOrderBookSide[] | undefined {
  if (!marketData) return undefined;
  const rows = [
    summarizeOrderBookSide("yes", marketData.yesOrderBook),
    summarizeOrderBookSide("no", marketData.noOrderBook)
  ].filter(isDefined);

  return rows.length > 0 ? rows : undefined;
}

function summarizeOrderBookSide(
  side: PredictionDetailOutcomeSide,
  orderBook?: OkxOutcomeOrderBook
): PredictionDetailOrderBookSide | undefined {
  if (!orderBook) return undefined;
  const bestBid = orderBook.bids[0]?.price;
  const bestAsk = orderBook.asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? Math.max(0, bestAsk - bestBid) : undefined;

  return {
    side,
    bestBidLabel: formatPrice(bestBid),
    bestAskLabel: formatPrice(bestAsk),
    spreadLabel: formatPrice(spread),
    depthLabel: `${orderBook.bids.length + orderBook.asks.length} 档`
  };
}

function createReadOnlyInsight(market: MarketSnapshot, outcomes: PredictionDetailOutcomeRow[]): string {
  const yes = outcomes.find((outcome) => outcome.side === "yes")?.priceLabel || "观察中";
  const no = outcomes.find((outcome) => outcome.side === "no")?.priceLabel || "观察中";
  const status = market.acceptingOrders ? "市场可观察" : "市场暂不适合行动";
  return `${status}，会 ${yes} / 不会 ${no}。Agent 只会做只读分析和模拟，不会下单、签名或广播交易。`;
}

function providerLabel(provider: MarketSnapshot["provider"]): string {
  if (provider === "okx-outcomes") return "OKX Outcomes";
  return "Polymarket";
}

function formatPrice(value?: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (value >= 0 && value <= 1) return `${Math.round(value * 100)}¢`;
  return formatNumber(value);
}

function formatAmount(value?: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000)}M`;
  if (value >= 1_000) return `${formatNumber(value / 1_000)}K`;
  return formatNumber(value);
}

function formatPriceChange(value: number): string {
  if (!Number.isFinite(value)) return "0¢";
  const cents = Math.round(Math.abs(value) * 100);
  if (cents === 0) return "0¢";
  return `${value > 0 ? "+" : "-"}${cents}¢`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function shortenId(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isOkxOutcomeMarketData(value: unknown): value is OkxOutcomeMarketData {
  if (!value || typeof value !== "object") return false;
  return "marketId" in value && ("market" in value || "yesTicker" in value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
